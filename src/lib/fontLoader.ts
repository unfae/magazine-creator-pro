import { supabase } from '@/lib/supabase';

const LS_VERSION_KEY = 'allowed_fonts_version';
const LS_FONTS_KEY = 'allowed_fonts_list';
const GLOBAL_FONTS = new Set(['inter', 'playfair display']);


export async function getAllowedFontsCached(): Promise<string[]> {
  // 1) read server version
  const { data: cfg } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'allowed_fonts_version')
    .maybeSingle();

  const serverVersion = cfg?.value ?? '0';

  // 2) read local cache
  const cachedVersion = localStorage.getItem(LS_VERSION_KEY);
  const cachedFontsRaw = localStorage.getItem(LS_FONTS_KEY);

  if (cachedVersion === serverVersion && cachedFontsRaw) {
    try {
      return JSON.parse(cachedFontsRaw);
    } catch {
      // fall through
    }
  }

  // 3) fetch active fonts
  const { data } = await supabase
    .from('allowed_fonts')
    .select('family')
    .eq('active', true);

  const families =
    (data ?? [])
      .map((r: any) => (r.family ?? '').trim())
      .filter(Boolean);

  localStorage.setItem(LS_VERSION_KEY, serverVersion);
  localStorage.setItem(LS_FONTS_KEY, JSON.stringify(families));

  return families;
}

export function ensureGoogleFontsLoaded(families: string[]) {
  const unique = Array.from(
    new Set(
        families
        .map((f) => f.trim())
        .filter(Boolean)
        .filter((f) => !GLOBAL_FONTS.has(f.toLowerCase()))
    )
    );

  if (unique.length === 0) return;

  const id = 'google-fonts-dynamic';
  const familyParam = unique
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@300;400;500;600;700`)
    .join('&');

  const href = `https://fonts.googleapis.com/css2?${familyParam}&display=swap`;

  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;
}
