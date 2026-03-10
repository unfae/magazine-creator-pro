// src/hooks/useTemplateVibes.ts
// Fetches vibes for a template. Each vibe bundles a palette + typography preset.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface VibeTypography {
  heading?: {
    fontFamily?: string;
    fontWeight?: string | number;
    fontSize?:   number;
    letterSpacing?: string;
    lineHeight?:    string;
    color?:      string;
  };
  body?: {
    fontFamily?: string;
    fontWeight?: string | number;
    fontSize?:   number;
    letterSpacing?: string;
    lineHeight?:    string;
    color?:      string;
  };
}

export interface VibeLayoutHints {
  spacing?:   'tight' | 'airy';
  alignment?: 'center' | 'left';
}

export interface TemplateVibe {
  id:           string;
  name:         string;
  description:  string | null;
  palette_id:   string | null;
  typography:   VibeTypography | null;
  layout_hints: VibeLayoutHints | null;
  sort_order:   number;
}

export function useTemplateVibes(templateId: string | null | undefined) {
  const [vibes, setVibes]     = useState<TemplateVibe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!templateId) { setLoading(false); return; }
    let cancelled = false;

    supabase
      .from('template_vibes')
      .select('id, name, description, palette_id, typography, layout_hints, sort_order')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) {
          setVibes((data as TemplateVibe[]) ?? []);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [templateId]);

  return { vibes, loading };
}

// ─── Typography application helper ───────────────────────────────────────────
// Given a text block's position in the layout (index 0 = heading, rest = body)
// and an active vibe, returns typography overrides to apply at render time.
// Returns null if no vibe is active or the vibe has no typography.

export function resolveVibeTypography(
  blockIndex: number,
  vibe: TemplateVibe | null
): Partial<{
  fontFamily: string;
  fontWeight: string | number;
  fontSize:   number;
  letterSpacing: string;
  lineHeight: string;
  color: string;
}> | null {
  if (!vibe?.typography) return null;
  const t = blockIndex === 0 ? vibe.typography.heading : vibe.typography.body;
  if (!t) return null;

  // Only return the fields that are actually set — don't override with undefined
  return Object.fromEntries(
    Object.entries(t).filter(([, v]) => v !== undefined && v !== null)
  ) as any;
}