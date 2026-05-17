// src/lib/assetMatcher.ts
// Matches AI-generated page concepts to assets in the bank.
// Falls back gracefully: DB match → Iconify → hardcoded default.

import { supabase } from '@/lib/supabase';

// ── Built-in layout pool (fallback when DB is empty) ─────────────────────────
// Actual layout_json objects the existing renderer understands.
// Spread across visual variety so no two consecutive pages look similar.

export const BUILTIN_LAYOUTS: Record<string, any> = {
  cover: {
    imageBlocks: [{ id: 'photo_1', x: 0, y: 0, width: 1000, height: 1415, zIndex: 1, rotate: 0, borderRadius: 0, editable: true }],
    textBlocks: [
      { id: 'headline', x: 40, y: 950, width: 920, height: 120, fontSize: 72, fontWeight: '700', fontFamily: 'Playfair Display', color: '#F5F0E8', align: 'center', zIndex: 10, lineHeight: '80', letterSpacing: '-1', rotate: 0, editable: true, type: 'required' },
      { id: 'tagline',  x: 40, y: 1090, width: 920, height: 60,  fontSize: 24, fontWeight: '300', fontFamily: 'DM Sans',          color: '#C69339', align: 'center', zIndex: 10, lineHeight: '30', letterSpacing: '2',  rotate: 0, editable: true, type: 'ai' },
    ],
  },
  full_bleed: {
    imageBlocks: [{ id: 'photo_1', x: 0, y: 0, width: 1000, height: 1000, zIndex: 1, rotate: 0, borderRadius: 0, editable: true }],
    textBlocks: [
      { id: 'headline', x: 40, y: 1040, width: 920, height: 100, fontSize: 52, fontWeight: '700', fontFamily: 'Playfair Display', color: '#1A1208', align: 'left', zIndex: 10, lineHeight: '58', letterSpacing: '-0.5', rotate: 0, editable: true, type: 'required' },
      { id: 'body',     x: 40, y: 1160, width: 920, height: 180, fontSize: 22, fontWeight: '400', fontFamily: 'DM Sans',          color: '#6B4E2A', align: 'left', zIndex: 10, lineHeight: '34', letterSpacing: '0',    rotate: 0, editable: true, type: 'ai' },
    ],
  },
  split_left: {
    imageBlocks: [{ id: 'photo_1', x: 0, y: 0, width: 480, height: 1415, zIndex: 1, rotate: 0, borderRadius: 0, editable: true }],
    textBlocks: [
      { id: 'headline', x: 520, y: 200,  width: 440, height: 200, fontSize: 52, fontWeight: '700', fontFamily: 'Playfair Display', color: '#1A1208', align: 'left', zIndex: 10, lineHeight: '60', letterSpacing: '-0.5', rotate: 0, editable: true, type: 'required' },
      { id: 'body',     x: 520, y: 430,  width: 440, height: 400, fontSize: 22, fontWeight: '400', fontFamily: 'DM Sans',          color: '#6B4E2A', align: 'left', zIndex: 10, lineHeight: '34', letterSpacing: '0',    rotate: 0, editable: true, type: 'ai' },
      { id: 'caption',  x: 520, y: 1300, width: 440, height: 60,  fontSize: 16, fontWeight: '400', fontFamily: 'Space Mono',       color: '#9A8870', align: 'left', zIndex: 10, lineHeight: '22', letterSpacing: '1',    rotate: 0, editable: true, type: 'optional' },
    ],
  },
  split_right: {
    imageBlocks: [{ id: 'photo_1', x: 520, y: 0, width: 480, height: 1415, zIndex: 1, rotate: 0, borderRadius: 0, editable: true }],
    textBlocks: [
      { id: 'headline', x: 40, y: 200,  width: 440, height: 200, fontSize: 52, fontWeight: '700', fontFamily: 'Playfair Display', color: '#1A1208', align: 'left', zIndex: 10, lineHeight: '60', letterSpacing: '-0.5', rotate: 0, editable: true, type: 'required' },
      { id: 'body',     x: 40, y: 430,  width: 440, height: 400, fontSize: 22, fontWeight: '400', fontFamily: 'DM Sans',          color: '#6B4E2A', align: 'left', zIndex: 10, lineHeight: '34', letterSpacing: '0',    rotate: 0, editable: true, type: 'ai' },
      { id: 'caption',  x: 40, y: 1300, width: 440, height: 60,  fontSize: 16, fontWeight: '400', fontFamily: 'Space Mono',       color: '#9A8870', align: 'left', zIndex: 10, lineHeight: '22', letterSpacing: '1',    rotate: 0, editable: true, type: 'optional' },
    ],
  },
  portrait_center: {
    imageBlocks: [{ id: 'photo_1', x: 200, y: 80, width: 600, height: 800, zIndex: 1, rotate: 0, borderRadius: 0, editable: true }],
    textBlocks: [
      { id: 'headline', x: 40, y: 920, width: 920, height: 120, fontSize: 52, fontWeight: '700', fontFamily: 'Playfair Display', color: '#1A1208', align: 'center', zIndex: 10, lineHeight: '60', letterSpacing: '-0.5', rotate: 0, editable: true, type: 'required' },
      { id: 'body',     x: 80, y: 1060, width: 840, height: 240, fontSize: 22, fontWeight: '400', fontFamily: 'DM Sans',          color: '#6B4E2A', align: 'center', zIndex: 10, lineHeight: '34', letterSpacing: '0',    rotate: 0, editable: true, type: 'ai' },
    ],
  },
  text_heavy: {
    imageBlocks: [{ id: 'photo_1', x: 0, y: 0, width: 1000, height: 420, zIndex: 1, rotate: 0, borderRadius: 0, editable: true }],
    textBlocks: [
      { id: 'headline',   x: 40, y: 460,  width: 920, height: 120, fontSize: 56, fontWeight: '700', fontFamily: 'Playfair Display', color: '#1A1208', align: 'left', zIndex: 10, lineHeight: '64', letterSpacing: '-0.5', rotate: 0, editable: true, type: 'required' },
      { id: 'subheading', x: 40, y: 600,  width: 920, height: 60,  fontSize: 24, fontWeight: '500', fontFamily: 'DM Sans',          color: '#C69339', align: 'left', zIndex: 10, lineHeight: '30', letterSpacing: '0',    rotate: 0, editable: true, type: 'ai' },
      { id: 'body',       x: 40, y: 690,  width: 920, height: 500, fontSize: 22, fontWeight: '400', fontFamily: 'DM Sans',          color: '#6B4E2A', align: 'left', zIndex: 10, lineHeight: '36', letterSpacing: '0',    rotate: 0, editable: true, type: 'ai' },
    ],
  },
  minimal: {
    imageBlocks: [],
    textBlocks: [
      { id: 'headline', x: 80, y: 400,  width: 840, height: 300, fontSize: 80, fontWeight: '300', fontFamily: 'Playfair Display', color: '#1A1208', align: 'center', zIndex: 10, lineHeight: '90', letterSpacing: '-2',   rotate: 0, editable: true, type: 'required' },
      { id: 'body',     x: 80, y: 740,  width: 840, height: 200, fontSize: 24, fontWeight: '400', fontFamily: 'DM Sans',          color: '#6B4E2A', align: 'center', zIndex: 10, lineHeight: '36', letterSpacing: '0',    rotate: 0, editable: true, type: 'ai' },
      { id: 'caption',  x: 80, y: 1300, width: 840, height: 60,  fontSize: 18, fontWeight: '400', fontFamily: 'Space Mono',       color: '#9A8870', align: 'center', zIndex: 10, lineHeight: '24', letterSpacing: '3',    rotate: 0, editable: true, type: 'optional' },
    ],
  },
  collage: {
    imageBlocks: [
      { id: 'photo_1', x: 0,   y: 0,   width: 490, height: 700, zIndex: 1, rotate: 0, borderRadius: 0, editable: true },
      { id: 'photo_2', x: 510, y: 0,   width: 490, height: 340, zIndex: 1, rotate: 0, borderRadius: 0, editable: true },
      { id: 'photo_3', x: 510, y: 360, width: 490, height: 340, zIndex: 1, rotate: 0, borderRadius: 0, editable: true },
    ],
    textBlocks: [
      { id: 'headline', x: 40,  y: 740,  width: 920, height: 120, fontSize: 52, fontWeight: '700', fontFamily: 'Playfair Display', color: '#1A1208', align: 'left', zIndex: 10, lineHeight: '60', letterSpacing: '-0.5', rotate: 0, editable: true, type: 'required' },
      { id: 'body',     x: 40,  y: 880,  width: 920, height: 360, fontSize: 22, fontWeight: '400', fontFamily: 'DM Sans',          color: '#6B4E2A', align: 'left', zIndex: 10, lineHeight: '34', letterSpacing: '0',    rotate: 0, editable: true, type: 'ai' },
    ],
  },
  editorial: {
    imageBlocks: [{ id: 'photo_1', x: 60, y: 60, width: 560, height: 700, zIndex: 1, rotate: -2, borderRadius: 0, editable: true }],
    textBlocks: [
      { id: 'headline', x: 580, y: 100, width: 380, height: 300, fontSize: 48, fontWeight: '700', fontFamily: 'Playfair Display', color: '#1A1208', align: 'right', zIndex: 10, lineHeight: '56', letterSpacing: '-0.5', rotate: 0, editable: true, type: 'required' },
      { id: 'body',     x: 580, y: 420, width: 380, height: 300, fontSize: 20, fontWeight: '400', fontFamily: 'DM Sans',          color: '#6B4E2A', align: 'right', zIndex: 10, lineHeight: '32', letterSpacing: '0',    rotate: 0, editable: true, type: 'ai' },
      { id: 'body2',    x: 40,  y: 800, width: 920, height: 440, fontSize: 22, fontWeight: '400', fontFamily: 'DM Sans',          color: '#6B4E2A', align: 'left',  zIndex: 10, lineHeight: '34', letterSpacing: '0',    rotate: 0, editable: true, type: 'ai' },
    ],
  },
  word_mask: {
    imageBlocks: [{ id: 'photo_1', x: 0, y: 200, width: 1000, height: 900, zIndex: 1, rotate: 0, borderRadius: 0, editable: true }],
    textBlocks: [
      { id: 'word',    x: 40, y: 250, width: 920, height: 800, fontSize: 220, fontWeight: '900', fontFamily: 'Playfair Display', color: '#1A1208', align: 'center', zIndex: 10, lineHeight: '220', letterSpacing: '-4', rotate: 0, editable: true, type: 'required' },
      { id: 'caption', x: 40, y: 1180, width: 920, height: 80, fontSize: 20, fontWeight: '400', fontFamily: 'Space Mono', color: '#9A8870', align: 'center', zIndex: 12, lineHeight: '26', letterSpacing: '4', rotate: 0, editable: true, type: 'optional' },
    ],
  },
};

const LAYOUT_ORDER = [
  'cover', 'full_bleed', 'split_left', 'portrait_center',
  'text_heavy', 'editorial', 'split_right', 'collage',
  'minimal', 'word_mask', 'full_bleed', 'split_right',
  'portrait_center', 'text_heavy', 'editorial', 'minimal',
];

// ── Iconify fetcher ───────────────────────────────────────────────────────────
// Tries each keyword in order until it gets a valid SVG.
// Converts to luma mask (white shape, black background).

export async function fetchIconifyMask(
  keywords: string[],
  width = 1000,
  height = 1415
): Promise<string | null> {
  const collections = ['ph', 'tabler', 'heroicons', 'mdi']; // Phosphor, Tabler, Heroicons, Material

  for (const keyword of keywords) {
    // Search Iconify for matching icons
    try {
      const searchRes = await fetch(
        `https://api.iconify.design/search?query=${encodeURIComponent(keyword)}&limit=5`
      );
      if (!searchRes.ok) continue;
      const searchData = await searchRes.json();
      const icons: string[] = searchData.icons ?? [];
      if (!icons.length) continue;

      // Prefer icons from our preferred collections
      const preferred = icons.find(i => collections.some(c => i.startsWith(c + ':')));
      const iconId = preferred ?? icons[0];

      // Fetch the SVG
      const [collection, name] = iconId.split(':');
      const svgRes = await fetch(
        `https://api.iconify.design/${collection}/${name}.svg?width=${width}&height=${height}&color=white`
      );
      if (!svgRes.ok) continue;

      const rawSvg = await svgRes.text();

      // Wrap in luma mask format: white icon on black background
      const lumaSvg = rawSvg
        .replace('<svg ', `<svg style="background:black;" `)
        .replace(/fill="[^"]*"/g, 'fill="white"')
        .replace(/stroke="[^"]*"/g, 'stroke="white"');

      return lumaSvg;
    } catch {
      continue;
    }
  }
  return null;
}

// ── Asset matcher ─────────────────────────────────────────────────────────────

export interface MatchedAssets {
  layout:      any;          // layout_json
  maskSvg:     string | null;
  modelPhoto:  string | null;
  background:  string | null;
  palette:     Record<string, string> | null;
  fontCombo:   Record<string, string> | null;
}

// Pick a layout — DB first, then builtin (avoiding recent repeats)
export async function matchLayout(
  layoutType: string,
  tags: string[],
  recentTypes: string[]
): Promise<{ json: any; type: string }> {
  // Try DB
  try {
    const { data } = await supabase
      .from('element_bank')
      .select('layout_json, tags, name')
      .eq('type', 'layout')
      .contains('tags', [layoutType])
      .limit(5);

    if (data?.length) {
      // Pick one not recently used
      const unused = data.filter(d => !recentTypes.includes(d.name));
      const pick = unused.length ? unused[0] : data[0];
      return { json: pick.layout_json, type: layoutType };
    }
  } catch { /* fall through */ }

  // Builtin fallback — pick closest match, avoid recent repeats
  const candidates = Object.keys(BUILTIN_LAYOUTS);
  const available = candidates.filter(c => !recentTypes.slice(-2).includes(c));

  // Try exact match first
  if (BUILTIN_LAYOUTS[layoutType] && !recentTypes.slice(-2).includes(layoutType)) {
    return { json: BUILTIN_LAYOUTS[layoutType], type: layoutType };
  }

  // Random from available (not recently used)
  const pool = available.length ? available : candidates;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return { json: BUILTIN_LAYOUTS[picked], type: picked };
}

// Match or fetch a mask SVG for a visual metaphor
export async function matchMask(
  metaphorKeywords: string[],
  templateBaseUrl: string
): Promise<string | null> {
  if (!metaphorKeywords?.length) return null;

  // 1. Check mask_bank table for existing match
  try {
    const { data } = await supabase
      .from('main_asset_bank')
      .select('url')
      .eq('type', 'mask')
      .overlaps('tags', metaphorKeywords)
      .limit(1)
      .maybeSingle();

    if (data?.url) return data.url;
  } catch { /* fall through */ }

  // 2. Try any mask from DB (random, for 60% coverage even without metaphor match)
  try {
    const { data: anyMask } = await supabase
      .from('main_asset_bank')
      .select('url')
      .eq('type', 'mask')
      .limit(30);

    if (anyMask?.length) {
      return anyMask[Math.floor(Math.random() * anyMask.length)].url;
    }
  } catch { /* fall through */ }

  // 3. Try Iconify
  const svg = await fetchIconifyMask(metaphorKeywords);
  if (svg) {
    // Save to Supabase Storage for reuse (best-effort, non-blocking)
    try {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const path = `masks/iconify-${metaphorKeywords[0]}-${Date.now()}.svg`;
      const { data: uploaded } = await supabase.storage
        .from('main-assets')
        .upload(path, blob, { contentType: 'image/svg+xml', upsert: false });

      if (uploaded) {
        const url = supabase.storage.from('main-assets').getPublicUrl(uploaded.path).data.publicUrl;
        // Save to bank for next time
        await supabase.from('main_asset_bank').insert({
          type: 'mask', name: metaphorKeywords[0],
          url, tags: [...metaphorKeywords, 'iconify', 'auto-generated'],
        });
        return url;
      }
    } catch { /* non-fatal */ }

    // Return as data URL if storage failed
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  return null;
}

// Match a model photo by gender + mood tags
// Falls back to any photo of the right gender if no specific match found
export async function matchModelPhoto(
  gender: string,
  imageDescription: string
): Promise<string | null> {
  const descLower = imageDescription.toLowerCase();
  const specificTags = [gender];
  if (descLower.includes('full') || descLower.includes('body')) specificTags.push('full_body');
  if (descLower.includes('portrait') || descLower.includes('close')) specificTags.push('portrait');
  if (descLower.includes('outdoor') || descLower.includes('street')) specificTags.push('outdoor');
  if (descLower.includes('studio') || descLower.includes('clean')) specificTags.push('studio');
  if (descLower.includes('candid') || descLower.includes('laugh')) specificTags.push('candid');
  if (descLower.includes('action') || descLower.includes('walk')) specificTags.push('action');

  try {
    // Try specific tags first
    const { data: specific } = await supabase
      .from('main_asset_bank')
      .select('url')
      .eq('type', 'model_photo')
      .overlaps('tags', specificTags)
      .limit(20);

    if (specific?.length) {
      return specific[Math.floor(Math.random() * specific.length)].url;
    }

    // Fallback: any model photo of this gender
    const { data: anyGender } = await supabase
      .from('main_asset_bank')
      .select('url')
      .eq('type', 'model_photo')
      .contains('tags', [gender])
      .limit(20);

    if (anyGender?.length) {
      return anyGender[Math.floor(Math.random() * anyGender.length)].url;
    }

    // Last resort: any model photo at all
    const { data: any } = await supabase
      .from('main_asset_bank')
      .select('url')
      .eq('type', 'model_photo')
      .limit(20);

    if (any?.length) {
      return any[Math.floor(Math.random() * any.length)].url;
    }
  } catch { /* fall through */ }

  return null;
}

// Match palette by mood tags
export async function matchPalette(
  colorDirection: string,
  vibes: string[]
): Promise<Record<string, string> | null> {
  const dirLower = colorDirection.toLowerCase();
  const tags: string[] = [...vibes];
  if (dirLower.includes('warm'))  tags.push('warm');
  if (dirLower.includes('cool'))  tags.push('cool');
  if (dirLower.includes('dark'))  tags.push('dark');
  if (dirLower.includes('light') || dirLower.includes('soft')) tags.push('soft');
  if (dirLower.includes('earth')) tags.push('earthy');

  try {
    const { data } = await supabase
      .from('element_bank')
      .select('data')
      .eq('type', 'palette')
      .overlaps('tags', tags.length ? tags : ['warm'])
      .limit(5);

    if (data?.length) {
      const pick = data[Math.floor(Math.random() * data.length)];
      return typeof pick.data === 'string' ? JSON.parse(pick.data) : pick.data;
    }
  } catch { /* fall through */ }

  return null;
}

// Match font combo by vibe tags
export async function matchFontCombo(
  vibes: string[],
  fontDirection: string
): Promise<Record<string, string> | null> {
  const dirLower = fontDirection.toLowerCase();
  const tags: string[] = [...vibes];
  if (dirLower.includes('serif') || dirLower.includes('classic')) tags.push('classic');
  if (dirLower.includes('bold') || dirLower.includes('condensed')) tags.push('bold');
  if (dirLower.includes('minimal') || dirLower.includes('clean')) tags.push('minimal');

  try {
    const { data } = await supabase
      .from('element_bank')
      .select('data')
      .eq('type', 'font_combo')
      .overlaps('tags', tags.length ? tags : ['elegant'])
      .limit(5);

    if (data?.length) {
      const pick = data[Math.floor(Math.random() * data.length)];
      return typeof pick.data === 'string' ? JSON.parse(pick.data) : pick.data;
    }
  } catch { /* fall through */ }

  return null;
}