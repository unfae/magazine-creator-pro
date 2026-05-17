// src/lib/variadicPageLayoutGenerator.ts
// Generates a VariadicPageLayout with variance fields pre-filled.
// Extends the standard pageLayoutGenerator with all new fields.

import type { VariadicPageLayout, VariadicTextBlock, VariadicImageBlock, DesignElement } from './variadicTypes';
import type { Align } from './pageLayoutGenerator';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Input types ───────────────────────────────────────────────────────────────

export interface VariadicTextInput {
  id: string;
  defaultText: string;
  fontFamilyOptions?: string[];   // e.g. ["Playfair Display", "Cormorant Garamond"]
  colorOptions?: string[];         // e.g. ["#fff", "#C69339"]
  xVariance?: [number, number];    // [min, max] offset
  yVariance?: [number, number];
  widthVariance?: [number, number];
  heightVariance?: [number, number];
  rotateVariance?: [number, number];
  textLengthRange?: [number, number]; // word count range for AI
  aiHint?: string;
  profileField?: string;
  paletteRole?: string;
}

export interface VariadicImageInput {
  maskGroup?: string;               // e.g. "1A" → picks 1A1.svg or 1A2.svg
  maskVariantCount?: number;
  xVariance?: [number, number];
  yVariance?: [number, number];
  widthVariance?: [number, number];
  heightVariance?: [number, number];
  rotateVariance?: [number, number];
  paletteRole?: string;
}

export interface DesignElementInput {
  id: string;
  type: 'line' | 'rect' | 'circle' | 'dot' | 'dot-grid';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity?: number;
  rotate?: number;
  zIndex?: number;
  borderRadius?: number;
  colorOptions?: string[];
  opacityVariance?: [number, number];
  xVariance?: [number, number];
  yVariance?: [number, number];
  rotateVariance?: [number, number];
  elementGroup?: string;            // e.g. "1C" → picks 1C1.svg or 1C2.svg
  elementVariantCount?: number;
  elementBaseUrl?: string;
}

export interface GenerateVariadicPageInput {
  pageNumber: number;
  photoSlots: number;
  pngElements: number;
  textCount: number;
  baseUrl: string;

  // Per-text overrides — if provided, applied to the matching index
  textInputs?: VariadicTextInput[];

  // Per-image variance — if provided, applied to the matching index
  // (photos first, then PNGs, matching letter order)
  imageInputs?: VariadicImageInput[];

  // Design elements to include
  designElements?: DesignElementInput[];

  // Default font family for text blocks
  fontFamily: string;

  // Default variance applied to ALL blocks unless overridden per-block
  defaultTextVariance?: { x?: [number, number]; y?: [number, number]; rotate?: [number, number] };
  defaultImageVariance?: { x?: [number, number]; y?: [number, number]; rotate?: [number, number] };

  paletteGroup?: string;
}

// ── Generator ─────────────────────────────────────────────────────────────────

export function generateVariadicPageLayout(input: GenerateVariadicPageInput): VariadicPageLayout {
  const { pageNumber, photoSlots, pngElements, textCount, baseUrl, fontFamily } = input;

  let mediaZ = 1;
  let textZ  = 10;
  let letterIdx = 0;

  const toRange = (t?: [number, number]) => t ? { min: t[0], max: t[1] } : undefined;

  // ── Photo blocks ──────────────────────────────────────────────────────────
  const photoBlocks: VariadicImageBlock[] = Array.from({ length: photoSlots }).map((_, i) => {
    const letter = indexToLetter(letterIdx++);
    const imgInput = input.imageInputs?.[i] ?? {};
    const defV = input.defaultImageVariance ?? {};

    return {
      id: `photo_${i + 1}`,
      x: 0, y: 0, width: 1000, height: 1415,
      zIndex: mediaZ++, rotate: 0, borderRadius: 0,
      border: { color: '#E5F1FF', style: 'solid', width: 0 },
      defaultImageUrl: joinUrl(baseUrl, `${pageNumber}${letter}.png`),
      editable: true,
      maskGroup:        imgInput.maskGroup,
      maskVariantCount: imgInput.maskVariantCount,
      paletteRole:      imgInput.paletteRole,
      xVariance:      toRange(imgInput.xVariance ?? defV.x as any),
      yVariance:      toRange(imgInput.yVariance ?? defV.y as any),
      widthVariance:  toRange(imgInput.widthVariance),
      heightVariance: toRange(imgInput.heightVariance),
      rotateVariance: toRange(imgInput.rotateVariance ?? defV.rotate as any),
    };
  });

  // ── PNG overlay blocks ────────────────────────────────────────────────────
  const pngOffset = photoSlots; // PNGs continue the letter index after photos
  const pngBlocks: VariadicImageBlock[] = Array.from({ length: pngElements }).map((_, i) => {
    const letter = indexToLetter(letterIdx++);
    const imgInput = input.imageInputs?.[pngOffset + i] ?? {};
    const defV = input.defaultImageVariance ?? {};

    return {
      id: `png_${i + 1}`,
      x: 0, y: 0, width: 1000, height: 1415,
      zIndex: mediaZ++, rotate: 0, borderRadius: 0,
      defaultImageUrl: joinUrl(baseUrl, `${pageNumber}${letter}.png`),
      editable: false,
      maskGroup:        imgInput.maskGroup,
      maskVariantCount: imgInput.maskVariantCount,
      paletteRole:      imgInput.paletteRole,
      xVariance:      toRange(imgInput.xVariance ?? defV.x as any),
      yVariance:      toRange(imgInput.yVariance ?? defV.y as any),
      widthVariance:  toRange(imgInput.widthVariance),
      heightVariance: toRange(imgInput.heightVariance),
      rotateVariance: toRange(imgInput.rotateVariance ?? defV.rotate as any),
    };
  });

  // ── Pagination (pages 2+) ─────────────────────────────────────────────────
  if (pageNumber > 1) {
    pngBlocks.push({
      id: 'pagination', x: 10, y: 1376, width: 980, height: 29,
      zIndex: 50, rotate: 0, borderRadius: 0,
      defaultImageUrl: joinUrl(baseUrl, `Page${pageNumber}.png`),
      editable: false,
    });
  }

  // ── Text blocks ───────────────────────────────────────────────────────────
  const textBlocks: VariadicTextBlock[] = Array.from({ length: textCount }).map((_, i) => {
    const ti = input.textInputs?.[i];
    const defV = input.defaultTextVariance ?? {};
    const z = textZ; textZ += 2;

    return {
      id:          ti?.id ?? `text_${i + 1}`,
      defaultText: ti?.defaultText ?? `Text ${i + 1}`,
      x: 40, y: 40 + i * 90, width: 920, height: 70,
      fontSize:      i === 0 ? 48 : 24,
      fontWeight:    i === 0 ? '700' : '500',
      fontFamily,
      color:         '#000000',
      align:         (i === 0 ? 'center' : 'left') as Align,
      zIndex:        z,
      lineHeight:    i === 0 ? '56' : '30',
      letterSpacing: '0',
      rotate: 0,
      editable: true,
      profileField:     ti?.profileField,
      aiHint:           ti?.aiHint,
      paletteRole:      ti?.paletteRole,
      fontFamilyOptions: ti?.fontFamilyOptions,
      colorOptions:      ti?.colorOptions,
      textLengthRange:   ti?.textLengthRange,
      xVariance:      toRange(ti?.xVariance ?? defV.x as any),
      yVariance:      toRange(ti?.yVariance ?? defV.y as any),
      widthVariance:  toRange(ti?.widthVariance),
      heightVariance: toRange(ti?.heightVariance),
      rotateVariance: toRange(ti?.rotateVariance ?? defV.rotate as any),
    };
  });

  // ── Design elements ───────────────────────────────────────────────────────
  const designElements: DesignElement[] = (input.designElements ?? []).map(el => ({
    id:            el.id,
    type:          el.type,
    x:             el.x,
    y:             el.y,
    width:         el.width,
    height:        el.height,
    color:         el.color,
    opacity:       el.opacity ?? 1,
    rotate:        el.rotate ?? 0,
    zIndex:        el.zIndex ?? 5,
    borderRadius:  el.borderRadius,
    colorOptions:  el.colorOptions,
    opacityVariance: el.opacityVariance ? { min: el.opacityVariance[0], max: el.opacityVariance[1] } : undefined,
    xVariance:      el.xVariance ? { min: el.xVariance[0], max: el.xVariance[1] } : undefined,
    yVariance:      el.yVariance ? { min: el.yVariance[0], max: el.yVariance[1] } : undefined,
    rotateVariance: el.rotateVariance ? { min: el.rotateVariance[0], max: el.rotateVariance[1] } : undefined,
    elementGroup:        el.elementGroup,
    elementVariantCount: el.elementVariantCount,
    elementBaseUrl:      el.elementBaseUrl,
  }));

  return {
    textBlocks,
    imageBlocks: [...photoBlocks, ...pngBlocks],
    designElements: designElements.length ? designElements : undefined,
    paletteGroup: input.paletteGroup,
  };
}