// src/lib/resolveVariance.ts
// Collapses a VariadicPageLayout into a ResolvedPageLayout by sampling
// all variance ranges. Uses a seeded PRNG so the same seed always
// produces the same output (deterministic per user+template).

import type {
  VariadicPageLayout, ResolvedPageLayout,
  VariadicTextBlock, VariadicImageBlock, DesignElement,
  ResolvedTextBlock, ResolvedImageBlock, ResolvedDesignElement,
  VarianceRange,
} from './variadicTypes';

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
// Simple, fast, good distribution. Seed is a 32-bit integer.

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Convert a string (userId + templateId) to a stable integer seed
function strToSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sampleRange(rng: () => number, range: VarianceRange): number {
  return range.min + rng() * (range.max - range.min);
}

function pickOne<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickVariant(rng: () => number, group: string, count: number): string {
  const variant = Math.floor(rng() * count) + 1;
  return `${group}${variant}`;
}

// ── Block resolvers ───────────────────────────────────────────────────────────

function resolveText(rng: () => number, tb: VariadicTextBlock): ResolvedTextBlock {
  const resolved = { ...tb } as any;

  if (tb.xVariance)      resolved.x         += sampleRange(rng, tb.xVariance);
  if (tb.yVariance)      resolved.y         += sampleRange(rng, tb.yVariance);
  if (tb.widthVariance)  resolved.width     += sampleRange(rng, tb.widthVariance);
  if (tb.heightVariance) resolved.height    += sampleRange(rng, tb.heightVariance);
  if (tb.rotateVariance) resolved.rotate    += sampleRange(rng, tb.rotateVariance);
  if (tb.fontFamilyOptions?.length) resolved.fontFamily = pickOne(rng, tb.fontFamilyOptions);
  if (tb.colorOptions?.length)      resolved.color      = pickOne(rng, tb.colorOptions);

  // Remove variance fields from output — renderer doesn't know about them
  delete resolved.xVariance; delete resolved.yVariance;
  delete resolved.widthVariance; delete resolved.heightVariance;
  delete resolved.rotateVariance; delete resolved.fontFamilyOptions;
  delete resolved.colorOptions; delete resolved.textLengthRange;

  return resolved as ResolvedTextBlock;
}

function resolveImage(
  rng: () => number,
  ib: VariadicImageBlock,
  templateBaseUrl: string
): ResolvedImageBlock {
  const resolved = { ...ib } as any;

  if (ib.xVariance)      resolved.x      += sampleRange(rng, ib.xVariance);
  if (ib.yVariance)      resolved.y      += sampleRange(rng, ib.yVariance);
  if (ib.widthVariance)  resolved.width  += sampleRange(rng, ib.widthVariance);
  if (ib.heightVariance) resolved.height += sampleRange(rng, ib.heightVariance);
  if (ib.rotateVariance) resolved.rotate += sampleRange(rng, ib.rotateVariance);

  // Resolve mask group → concrete SVG URL
  if (ib.maskGroup) {
    const variantName = pickVariant(rng, ib.maskGroup, ib.maskVariantCount ?? 2);
    const base = templateBaseUrl.replace(/\/+$/, '');
    resolved.mask = {
      type: 'svg',
      src: `${base}/masks/${variantName}.svg`,
    };
  }

  delete resolved.xVariance; delete resolved.yVariance;
  delete resolved.widthVariance; delete resolved.heightVariance;
  delete resolved.rotateVariance; delete resolved.maskGroup; delete resolved.maskVariantCount;

  return resolved as ResolvedImageBlock;
}

function resolveElement(rng: () => number, el: DesignElement, templateBaseUrl: string): ResolvedDesignElement {
  const resolved = { ...el } as any;

  if (el.xVariance)       resolved.x       += sampleRange(rng, el.xVariance);
  if (el.yVariance)       resolved.y       += sampleRange(rng, el.yVariance);
  if (el.rotateVariance)  resolved.rotate  += sampleRange(rng, el.rotateVariance);
  if (el.opacityVariance) resolved.opacity  = sampleRange(rng, el.opacityVariance);
  if (el.colorOptions?.length) resolved.color = pickOne(rng, el.colorOptions);

  // Resolve element group → variant identifier (used by renderer as a CSS class
  // for pure shapes, or as an SVG src for complex elements)
  if (el.elementGroup) {
    const variantName = pickVariant(rng, el.elementGroup, el.elementVariantCount ?? 2);
    const base = (el.elementBaseUrl ?? templateBaseUrl).replace(/\/+$/, '');
    resolved.resolvedElementVariant = variantName;
    resolved.resolvedElementUrl = `${base}/elements/${variantName}.svg`;
  }

  delete resolved.xVariance; delete resolved.yVariance;
  delete resolved.rotateVariance; delete resolved.colorOptions;
  delete resolved.opacityVariance; delete resolved.elementGroup;
  delete resolved.elementVariantCount; delete resolved.elementBaseUrl;

  return resolved as ResolvedDesignElement;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface ResolveOptions {
  /** String seed — typically userId + templateId + pageNumber */
  seedString?: string;
  /** Explicit numeric seed — overrides seedString */
  seed?: number;
  /** Base URL for mask/element SVG files */
  templateBaseUrl?: string;
}

export function resolveVariance(
  layout: VariadicPageLayout,
  options: ResolveOptions = {}
): ResolvedPageLayout {
  const numericSeed = options.seed ?? strToSeed(options.seedString ?? String(Date.now()));
  const rng = mulberry32(numericSeed);
  const base = options.templateBaseUrl ?? '';

  return {
    textBlocks:      layout.textBlocks.map(tb => resolveText(rng, tb)),
    imageBlocks:     layout.imageBlocks.map(ib => resolveImage(rng, ib, base)),
    designElements:  layout.designElements?.map(el => resolveElement(rng, el, base)),
  };
}

/** Convenience: derive a seed string from user + template + page */
export function makeSeedString(userId: string, templateId: string, pageNumber: number): string {
  return `${userId}__${templateId}__${pageNumber}`;
}