// src/lib/pageLayoutGenerator.ts

export type Align = 'left' | 'center' | 'right';

export interface TextBlock {
  id: string;
  x: number; y: number;
  width: number; height: number;
  defaultText: string;
  fontSize: number;
  fontWeight: string;
  fontFamily: string;
  color: string;
  align: Align;
  zIndex: number;
  lineHeight: string;
  letterSpacing: string;
  rotate: number;
  editable: boolean;
}

export interface ImageBlock {
  id: string;
  x: number; y: number;
  width: number; height: number;
  zIndex: number;
  rotate: number;
  borderRadius: number;
  border?: { color: string; style: 'solid' | 'dashed' | 'dotted'; width: number };
  defaultImageUrl: string;
  editable: boolean;
}

export interface PageLayout {
  pageName: string;        // unique, not guessable
  textBlocks: TextBlock[];
  imageBlocks: ImageBlock[];
}

/**
 * crypto.randomUUID() is the simplest secure option in modern browsers. [web:625]
 * Fallback included for older browsers.
 */
function uniquePageName(prefix = 'page'): string {
  const c: Crypto | undefined = typeof window !== 'undefined' ? window.crypto : undefined;
  const uuid =
    (c as any)?.randomUUID?.() ??
    // fallback uuid v4-ish (uses crypto.getRandomValues when randomUUID is missing)
    ([1e7] as any + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (ch: string) => {
      const r = (c?.getRandomValues?.(new Uint8Array(1))?.[0] ?? Math.floor(Math.random() * 256));
      const n = Number(ch);
      return ((n ^ (r & (15 >> (n / 4))))).toString(16);
    });

  return `${prefix}_${uuid}`;
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export interface GeneratePageInput {
  // counts
  photoSlots: number;       // editable image placeholders
  pngElements: number;      // non-editable overlay pngs
  textCount: number;

  // sources
  photosBaseUrl: string;    // e.g. https://<ref>.supabase.co/storage/v1/object/public/template_pages/elegance
  pngBaseUrl: string;       // can be same as above
  photoPaths?: string[];    // optional explicit paths like ["0.png","1.png"] (else generated)
  pngPaths?: string[];      // optional explicit paths like ["overlay.png","shape.png"] (else generated)

  // text
  texts: Array<Pick<TextBlock, 'id' | 'defaultText'>>; // supply ids + text values
  fontFamily: string;       // e.g. "PlayfairDisplay SC"
}

export function generatePageLayout(input: GeneratePageInput): PageLayout {
  const pageName = uniquePageName('tpl');

  // Simple grid auto-layout (you can edit positions afterwards)
  const canvas = { w: 1000, h: 1400, pad: 40 };

  // --- Text blocks ---
  const textBlocks: TextBlock[] = Array.from({ length: input.textCount }).map((_, i) => {
    const t = input.texts[i] ?? { id: `text_${i + 1}`, defaultText: `Text ${i + 1}` };

    return {
      id: t.id,
      x: canvas.pad,
      y: canvas.pad + i * 90,
      width: canvas.w - canvas.pad * 2,
      height: 70,
      defaultText: t.defaultText,
      fontSize: i === 0 ? 48 : 24,
      fontWeight: i === 0 ? '700' : '500',
      fontFamily: input.fontFamily,
      color: '#111111',
      align: i === 0 ? 'center' : 'left',
      zIndex: 10 + i,
      lineHeight: i === 0 ? '56' : '30',
      letterSpacing: '0',
      rotate: 0,
      editable: true,
    };
  });

  // --- Editable photo placeholders ---
  const photoPaths =
    input.photoPaths?.length ? input.photoPaths : Array.from({ length: input.photoSlots }).map((_, i) => `${i}.png`);

  const photoBlocks: ImageBlock[] = photoPaths.slice(0, input.photoSlots).map((p, i) => {
    // basic vertical stacking below title area
    const yStart = canvas.pad + Math.max(input.textCount, 1) * 90 + 40;
    return {
      id: `photo_${i + 1}`,
      x: canvas.pad,
      y: yStart + i * 420,
      width: canvas.w - canvas.pad * 2,
      height: 380,
      zIndex: 1 + i,
      rotate: 0,
      borderRadius: 0,
      border: { color: '#E5F1FF', style: 'solid', width: 0 },
      defaultImageUrl: joinUrl(input.photosBaseUrl, p),
      editable: true,
    };
  });

  // --- PNG overlays (non-editable) ---
  const pngPaths =
    input.pngPaths?.length ? input.pngPaths : Array.from({ length: input.pngElements }).map((_, i) => `overlay_${i + 1}.png`);

  const pngBlocks: ImageBlock[] = pngPaths.slice(0, input.pngElements).map((p, i) => ({
    id: `png_${i + 1}`,
    x: 300 + i * 20,
    y: 320 + i * 20,
    width: 400,
    height: 400,
    zIndex: 100 + i,
    rotate: 0,
    borderRadius: 0,
    defaultImageUrl: joinUrl(input.pngBaseUrl, p),
    editable: false,
  }));

  return {
    pageName,
    textBlocks,
    imageBlocks: [...photoBlocks, ...pngBlocks],
  };
}
