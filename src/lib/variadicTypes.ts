// src/lib/variadicTypes.ts
// Option-array format: any field can be a scalar OR an array.
// The resolver picks array[v] where v = variant index (0, 1, 2...).

export type Align = 'left' | 'center' | 'right';

// Opt<T> — can be a single value or an array of values (one per variant)
type Opt<T> = T | T[];

// ── Text fill background ──────────────────────────────────────────────────────
export interface TextFill {
  color:        string;
  borderRadius?: number;
  padding?:      number;
}

// ── HSL colour spec for shapes ────────────────────────────────────────────────
// h can be an option array; s and l are fixed or l uses a range
export interface HslSpec {
  h:       Opt<number>;         // hue: scalar or option array
  s:       number;              // saturation: fixed
  lRange?: [number, number];    // pick L randomly within range
  l?:      number;              // OR fixed L
}

// ── Shadow ────────────────────────────────────────────────────────────────────
// CSS box-shadow string, or null for no shadow, or option array
export type ShadowValue = string | null;

// ── Variadic Text Block ───────────────────────────────────────────────────────
export interface VariadicTextBlock {
  id:            string;
  x:             Opt<number>;
  y:             Opt<number>;
  width:         Opt<number>;
  height:        Opt<number>;
  defaultText:   string;
  fontSize:      Opt<number>;
  fontWeight:    string;
  // fontFamily: string = use this family; string[] = pick one per variant
  fontFamily:    string | string[];
  // color: hex string, option array, OR "$rule" string
  // "$rule" examples: "contrast(background)", "palette(accent)"
  color:         Opt<string>;
  align:         Align;
  zIndex:        Opt<number>;
  lineHeight:    string;
  letterSpacing: string;
  rotate:        Opt<number>;
  editable:      boolean;

  // Text type — drives editor UI
  // required: highlighted, user must fill
  // ai:       can be left empty, Claude fills it
  // optional: shown but not required
  type?:         'required' | 'ai' | 'optional';

  // Background fill behind the text
  fill?:         Opt<TextFill | null>;

  // Shadow
  shadow?:       Opt<ShadowValue>;

  // Metadata
  profileField?: string;
  aiHint?:       string;
  paletteRole?:  string;
}

// ── Variadic Image Block ──────────────────────────────────────────────────────
export interface VariadicImageBlock {
  id:              string;
  x:               Opt<number>;
  y:               Opt<number>;
  width:           Opt<number>;
  height:          Opt<number>;
  zIndex:          Opt<number>;
  rotate:          Opt<number>;
  // borderRadius: number (all corners), CSS string "tl tr br bl", or option array
  borderRadius:    Opt<number | string>;
  border?:         { color: string; style: string; width: number };
  defaultImageUrl: string;
  editable:        boolean;
  paletteRole?:    string;
  shadow?:         Opt<ShadowValue>;

  // Mask
  mask?:            { type: 'svg' | 'css' | 'none'; src?: string; cssValue?: string };
  maskGroup?:       string;
  // maskVariant: which file variant to use per layout option
  maskVariant?:     Opt<number>;
}

// ── Variadic Page Layout ──────────────────────────────────────────────────────
export interface VariadicPageLayout {
  // Total number of variants on this page
  _variants?:    number;

  // Page background — hex, option array, or "$rule"
  background?:   Opt<string>;

  textBlocks:    VariadicTextBlock[];
  imageBlocks:   VariadicImageBlock[];

  // Colour groups: { groupId: string[] } — stored as JSON object
  paletteGroup?: string | Record<string, string[]>;
}

// ── Resolved (concrete) layout ────────────────────────────────────────────────
// After resolveVariance() all arrays → single values, rules → computed values.
// Shape matches what the existing renderer already expects.

export interface ResolvedTextBlock extends Omit<VariadicTextBlock,
  'x' | 'y' | 'width' | 'height' | 'fontSize' | 'fontFamily' |
  'color' | 'zIndex' | 'rotate' | 'fill' | 'shadow'
> {
  x: number; y: number; width: number; height: number;
  fontSize: number; fontFamily: string;
  color: string; zIndex: number; rotate: number;
  fill?: TextFill | null;
  shadow?: ShadowValue;
}

export interface ResolvedImageBlock extends Omit<VariadicImageBlock,
  'x' | 'y' | 'width' | 'height' | 'zIndex' | 'rotate' |
  'borderRadius' | 'shadow' | 'maskVariant'
> {
  x: number; y: number; width: number; height: number;
  zIndex: number; rotate: number;
  borderRadius: number | string;
  shadow?: ShadowValue;
}

export interface ResolvedPageLayout {
  background?:  string;
  textBlocks:   ResolvedTextBlock[];
  imageBlocks:  ResolvedImageBlock[];
  paletteGroup?: string | Record<string, string[]>;
}