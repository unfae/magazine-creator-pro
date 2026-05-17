// src/hooks/useTemplatePalettes.ts
// Fetches colour palettes for a template from template_palettes table.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface PaletteColors {
  primary:    string;
  secondary:  string;
  accent:     string;
  text:       string;
  background: string;
}

export interface TemplatePalette {
  id:         string;
  name:       string;
  colors:     PaletteColors;
  sort_order: number;
}

export function useTemplatePalettes(templateId: string | null | undefined) {
  const [palettes, setPalettes]     = useState<TemplatePalette[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!templateId) { setLoading(false); return; }
    let cancelled = false;

    supabase
      .from('template_palettes')
      .select('id, name, colors, sort_order')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) {
          setPalettes((data as TemplatePalette[]) ?? []);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [templateId]);

  return { palettes, loading };
}

// ─── Palette application helpers ─────────────────────────────────────────────
// Call resolvePaletteColor(block.paletteRole, palette) to get the override
// colour for any block that has a paletteRole. Returns null if no override.

export function resolvePaletteColor(
  role: string | undefined,
  palette: TemplatePalette | null
): string | null {
  if (!role || !palette) return null;
  const map: Record<string, keyof PaletteColors> = {
    primary:    'primary',
    secondary:  'secondary',
    accent:     'accent',
    text:       'text',
    background: 'background',
  };
  const key = map[role];
  return key ? (palette.colors[key] ?? null) : null;
}