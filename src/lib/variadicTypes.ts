// src/lib/variadicTypes.ts
// Variadic layout format — extends standard layout_json blocks with optional
// variance fields. The resolver collapses these into concrete values at render time.

import type { Align } from './pageLayoutGenerator';

// ── Shared ────────────────────────────────────────────────────────────────────

export interface VarianceRange {
  min: number;
  max: number;
}

// ── Variadic Text Block ───────────────────────────────────────────────────────

export interface VariadicTextBlock {
  // ── Base fields (same as TextBlock) ──────────────────────────────────────
  id:            string;
  x:             number;
  y:             number;
  width:         number;
  height:        number;
  defaultText:   string;
  fontSize:      number;
  fontWeight:    string;
  fontFamily:    string;
  color:         string;
  align:         Align;
  zIndex:        number;
  lineHeight:    string;
  letterSpacing: string;
  rotate:        number;
  editable:      boolean;
  profileField?: string;
  aiHint?:       string;
  paletteRole?:  string;

  // ── Variance fields (all optional) ───────────────────────────────────────
  xVariance?:          VarianceRange;   // random offset added to x
  yVariance?:          VarianceRange;   // random offset added to y
  widthVariance?:      VarianceRange;   // random delta applied to width
  heightVariance?:     VarianceRange;   // random delta applied to height
  rotateVariance?:     VarianceRange;   // e.g. { min: -3, max: 3 }
  fontFamilyOptions?:  string[];        // picks one; overrides fontFamily
  colorOptions?:       string[];        // picks one; overrides color
  textLengthRange?:    [number, number]; // word count hint for AI text gen
}

// ── Variadic Image Block ──────────────────────────────────────────────────────

export interface VariadicImageBlock {
  // ── Base fields ───────────────────────────────────────────────────────────
  id:               string;
  x:                number;
  y:                number;
  width:            number;
  height:           number;
  zIndex:           number;
  rotate:           number;
  borderRadius:     number;
  border?:          { color: string; style: 'solid' | 'dashed' | 'dotted'; width: number };
  defaultImageUrl:  string;
  editable:         boolean;
  paletteRole?:     string;
  mask?:            { type: 'svg' | 'css' | 'none'; src?: string; cssValue?: string };

  // ── Variance fields ───────────────────────────────────────────────────────
  xVariance?:      VarianceRange;
  yVariance?:      VarianceRange;
  widthVariance?:  VarianceRange;
  heightVariance?: VarianceRange;
  rotateVariance?: VarianceRange;

  // Mask group: e.g. "1A" → resolver picks from 1A1.svg, 1A2.svg, 1A3.svg etc.
  // Files live at: {templateBaseUrl}/masks/{group}{variant}.svg
  maskGroup?:        string;
  maskVariantCount?: number; // how many variants exist for this group (default: 2)
}

// ── Design Element ────────────────────────────────────────────────────────────
// Non-photo, non-text decorative elements: lines, rectangles, circles, dot grids.
// Width + height are FIXED per variant file (not randomised) — only position,
// rotation, and colour vary.

export type DesignElementType = 'line' | 'rect' | 'circle' | 'dot' | 'dot-grid';

export interface DesignElement {
  id:           string;
  type:         DesignElementType;
  x:            number;
  y:            number;
  width:        number;  // fixed — matches the variant's intrinsic size
  height:       number;  // fixed
  color:        string;
  opacity:      number;  // 0–1
  rotate:       number;
  zIndex:       number;
  borderRadius?: number;

  // Variance
  xVariance?:      VarianceRange;
  yVariance?:      VarianceRange;
  rotateVariance?: VarianceRange;
  colorOptions?:   string[];  // picks one
  opacityVariance?: VarianceRange; // e.g. { min: 0.3, max: 0.8 }

  // Element group — naming mirrors mask groups: pageNum + letter + variant
  // e.g. "1C" → resolver picks from 1C1, 1C2 … (used as an SVG src OR as
  // a CSS shape class for pure CSS elements like lines/rects/circles)
  elementGroup?:        string;
  elementVariantCount?: number;
  elementBaseUrl?:      string; // overrides template base URL for this element
}

// ── Variadic Page Layout ──────────────────────────────────────────────────────

export interface VariadicPageLayout {
  textBlocks:      VariadicTextBlock[];
  imageBlocks:     VariadicImageBlock[];
  designElements?: DesignElement[];

  // Palette group — if set, the resolver picks a palette tagged with this
  // group name from template_palettes
  paletteGroup?: string;
}

// ── Resolved (concrete) versions of variadic blocks ──────────────────────────
// After resolveVariance() runs, all variance fields are collapsed.
// The result matches the standard TextBlock / ImageBlock shapes exactly
// so the existing renderer works without changes.

export interface ResolvedTextBlock extends Omit<VariadicTextBlock,
  'xVariance' | 'yVariance' | 'widthVariance' | 'heightVariance' |
  'rotateVariance' | 'fontFamilyOptions' | 'colorOptions' | 'textLengthRange'
> {}

export interface ResolvedImageBlock extends Omit<VariadicImageBlock,
  'xVariance' | 'yVariance' | 'widthVariance' | 'heightVariance' |
  'rotateVariance' | 'maskGroup' | 'maskVariantCount'
> {}

export interface ResolvedDesignElement extends Omit<DesignElement,
  'xVariance' | 'yVariance' | 'rotateVariance' | 'colorOptions' |
  'opacityVariance' | 'elementGroup' | 'elementVariantCount'
> {}

export interface ResolvedPageLayout {
  textBlocks:      ResolvedTextBlock[];
  imageBlocks:     ResolvedImageBlock[];
  designElements?: ResolvedDesignElement[];
  resolvedPaletteId?: string;
}