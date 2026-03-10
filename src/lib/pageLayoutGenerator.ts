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
  textBlocks: TextBlock[];
  imageBlocks: ImageBlock[];
}

// 0-based index → A, B, C … Z, AA, AB …
function indexToLetter(i: number): string {
  let result = '';
  let n = i;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export interface GeneratePageInput {
  pageNumber: number;    // which page — drives file names (2A, 2B…) + pagination element
  photoSlots: number;
  pngElements: number;
  textCount: number;
  baseUrl: string;       // single base URL for both photos and PNGs
  texts: Array<Pick<TextBlock, 'id' | 'defaultText'>>;
  fontFamily: string;
}

export function generatePageLayout(input: GeneratePageInput): PageLayout {
  const { pageNumber, photoSlots, pngElements, textCount, baseUrl, texts, fontFamily } = input;

  // Z-index counters:
  //   photos + decorative PNGs → start 1, +1 each
  //   texts                    → start 10, +2 each
  let mediaZ = 1;
  let textZ = 10;

  // Photos claim letters first, then decorative PNGs continue the same sequence.
  // e.g. page 2, 2 photos + 1 PNG  →  2A, 2B (photos)  2C (PNG)
  let letterIdx = 0;

  // ── Editable photo placeholders ──────────────────────────────────────────
  const photoBlocks: ImageBlock[] = Array.from({ length: photoSlots }).map((_, i) => ({
    id: `photo_${i + 1}`,
    x: 0,
    y: 0,
    width: 1000,
    height: 1415,
    zIndex: mediaZ++,
    rotate: 0,
    borderRadius: 0,
    border: { color: '#E5F1FF', style: 'solid', width: 0 },
    defaultImageUrl: joinUrl(baseUrl, `${pageNumber}${indexToLetter(letterIdx++)}.png`),
    editable: true,
  }));

  // ── Decorative PNG overlays ───────────────────────────────────────────────
  const pngBlocks: ImageBlock[] = Array.from({ length: pngElements }).map((_, i) => ({
    id: `png_${i + 1}`,
    x: 0,
    y: 0,
    width: 1000,
    height: 1415,
    zIndex: mediaZ++,
    rotate: 0,
    borderRadius: 0,
    defaultImageUrl: joinUrl(baseUrl, `${pageNumber}${indexToLetter(letterIdx++)}.png`),
    editable: false,
  }));

  // ── Pagination element (pages 2+) ─────────────────────────────────────────
  // Fixed size/position; file named Page2.png, Page3.png etc.
  if (pageNumber > 1) {
    pngBlocks.push({
      id: 'pagination',
      x: 10,
      y: 1376,
      width: 980,
      height: 29,
      zIndex: 50,
      rotate: 0,
      borderRadius: 0,
      defaultImageUrl: joinUrl(baseUrl, `Page${pageNumber}.png`),
      editable: false,
    });
  }

  // ── Text blocks ───────────────────────────────────────────────────────────
  const textBlocks: TextBlock[] = Array.from({ length: textCount }).map((_, i) => {
    const t = texts[i] ?? { id: `text_${i + 1}`, defaultText: `Text ${i + 1}` };
    const z = textZ;
    textZ += 2;
    return {
      id: t.id,
      x: 40,
      y: 40 + i * 90,
      width: 920,
      height: 70,
      defaultText: t.defaultText,
      fontSize: i === 0 ? 48 : 24,
      fontWeight: i === 0 ? '700' : '500',
      fontFamily,
      color: '#000000',
      align: i === 0 ? 'center' : 'left',
      zIndex: z,
      lineHeight: i === 0 ? '56' : '30',
      letterSpacing: '0',
      rotate: 0,
      editable: true,
    };
  });

  return { textBlocks, imageBlocks: [...photoBlocks, ...pngBlocks] };
}