// src/lib/resolveVariance.ts
// Resolves a VariadicPageLayout into a concrete ResolvedPageLayout.
// Uses a variant index v (0, 1, 2...) — any array picks array[v].
// Also evaluates "$rule" colour strings and HslSpec objects.

import type {
  VariadicPageLayout, ResolvedPageLayout,
  VariadicTextBlock, VariadicImageBlock,
  ResolvedTextBlock, ResolvedImageBlock,
  HslSpec, TextFill, ShadowValue,
} from './variadicTypes';

// ── Seeded PRNG (for lRange sampling only) ────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function strToSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ── pick(v, value) ────────────────────────────────────────────────────────────
// Core operation: if value is an array, return value[v % length]; else return as-is.
function pick<T>(v: number, value: T | T[]): T {
  if (Array.isArray(value)) return value[v % value.length];
  return value as T;
}

// ── Colour rule evaluator ─────────────────────────────────────────────────────
// Supports:
//   contrast(background)     → '#000' or '#fff' based on background lightness
//   palette(slot)            → placeholder; caller can override post-resolve
//   darken(hex, amount)      → not yet implemented, returns hex
//   any hex string           → returned as-is

function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return 0.5;
  const [r, g, b] = m.map(h => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function evalColorRule(rule: string, ctx: ResolveContext): string {
  if (!rule.startsWith('$') && !rule.includes('(')) return rule;

  const inner = rule.replace(/^\$/, '');

  if (inner.startsWith('contrast(')) {
    const ref = inner.slice(9, -1).trim();
    const bg  = ctx.resolvedBackground ?? '#ffffff';
    return luminance(bg) > 0.35 ? '#000000' : '#ffffff';
  }

  if (inner.startsWith('palette(')) {
    // Return a placeholder — caller should substitute real palette values
    const slot = inner.slice(8, -1).trim();
    return `__palette_${slot}__`;
  }

  return inner; // fallback
}

// ── HSL resolver ──────────────────────────────────────────────────────────────
function resolveHsl(hsl: HslSpec, rng: () => number, v: number): string {
  const h = pick(v, hsl.h);
  const s = hsl.s;
  const l = hsl.lRange
    ? Math.round(hsl.lRange[0] + rng() * (hsl.lRange[1] - hsl.lRange[0]))
    : (hsl.l ?? 50);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// ── Context passed through resolution ────────────────────────────────────────
interface ResolveContext {
  v:                   number;
  rng:                 () => number;
  resolvedBackground?: string;
  templateBaseUrl:     string;
}

// ── Block resolvers ───────────────────────────────────────────────────────────

function resolveColor(raw: string | string[], ctx: ResolveContext): string {
  const val = pick(ctx.v, raw as any);
  if (typeof val === 'string' && (val.startsWith('$') || val.includes('('))) {
    return evalColorRule(val, ctx);
  }
  return val ?? '#000000';
}

function resolveText(tb: VariadicTextBlock, ctx: ResolveContext): ResolvedTextBlock {
  const color = resolveColor(tb.color as any, ctx);

  // fontFamily: string = use as-is; string[] = pick by v
  const fontFamily = Array.isArray(tb.fontFamily)
    ? (tb.fontFamily[ctx.v % tb.fontFamily.length] ?? tb.fontFamily[0])
    : tb.fontFamily;

  // fill — each option can be TextFill or null
  const rawFill = tb.fill !== undefined ? pick(ctx.v, tb.fill as any) : undefined;

  return {
    ...tb,
    x:          pick(ctx.v, tb.x),
    y:          pick(ctx.v, tb.y),
    width:      pick(ctx.v, tb.width),
    height:     pick(ctx.v, tb.height),
    fontSize:   pick(ctx.v, tb.fontSize),
    fontFamily,
    color,
    zIndex:     pick(ctx.v, tb.zIndex),
    rotate:     pick(ctx.v, tb.rotate),
    fill:       rawFill as TextFill | null | undefined,
    shadow:     tb.shadow !== undefined ? (pick(ctx.v, tb.shadow as any) as ShadowValue) : undefined,
  };
}

function resolveImage(ib: VariadicImageBlock, ctx: ResolveContext): ResolvedImageBlock {
  // Resolve maskGroup + maskVariant → concrete mask src
  let mask = ib.mask;
  if (!mask && ib.maskGroup) {
    const variant = ib.maskVariant !== undefined
      ? pick(ctx.v, ib.maskVariant as any)
      : 1;
    mask = {
      type: 'svg',
      src: `${ctx.templateBaseUrl}/masks/${ib.maskGroup}${variant}.svg`,
    };
  }

  return {
    ...ib,
    x:            pick(ctx.v, ib.x),
    y:            pick(ctx.v, ib.y),
    width:        pick(ctx.v, ib.width),
    height:       pick(ctx.v, ib.height),
    zIndex:       pick(ctx.v, ib.zIndex),
    rotate:       pick(ctx.v, ib.rotate),
    borderRadius: pick(ctx.v, ib.borderRadius as any),
    shadow:       ib.shadow !== undefined ? (pick(ctx.v, ib.shadow as any) as ShadowValue) : undefined,
    mask,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface ResolveOptions {
  /** Which variant index to use (0-based). Default: 0 */
  v?:              number;
  /** Seed string for lRange sampling (userId + templateId + pageNumber) */
  seedString?:     string;
  /** Base URL for mask SVG files */
  templateBaseUrl?: string;
}

export function resolveVariance(
  layout: VariadicPageLayout,
  options: ResolveOptions = {}
): ResolvedPageLayout {
  const v    = options.v ?? 0;
  const seed = strToSeed(options.seedString ?? String(v));
  const rng  = mulberry32(seed);
  const base = options.templateBaseUrl ?? '';

  // Resolve background first — needed for contrast() rule
  const rawBg = layout.background;
  const resolvedBackground = rawBg
    ? (Array.isArray(rawBg) ? rawBg[v % rawBg.length] : rawBg as string)
    : undefined;

  const ctx: ResolveContext = { v, rng, resolvedBackground, templateBaseUrl: base };

  return {
    background:   resolvedBackground,
    textBlocks:   layout.textBlocks.map(tb => resolveText(tb, ctx)),
    imageBlocks:  layout.imageBlocks.map(ib => resolveImage(ib, ctx)),
    paletteGroup: layout.paletteGroup,
  };
}

/** Derive a stable seed string */
export function makeSeedString(userId: string, templateId: string, pageNumber: number): string {
  return `${userId}__${templateId}__${pageNumber}`;
}