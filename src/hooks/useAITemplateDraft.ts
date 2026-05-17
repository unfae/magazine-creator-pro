// src/hooks/useAITemplateDraft.ts
// Loads and auto-saves draft state for AI templates.
// State: text values, image transforms (zoom/pan/bg), palette, vibe.
// Uses a 1.5s debounce so we don't hit Supabase on every keystroke.

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ImageTransform {
  scale:        number;   // 1.0 = no zoom
  offsetX:      number;   // px pan from center
  offsetY:      number;   // px pan from center
  bgRemoved:    boolean;
  originalUrl:  string | null;
  processedUrl: string | null; // bg-removed version
}

export const DEFAULT_TRANSFORM: ImageTransform = {
  scale: 1, offsetX: 0, offsetY: 0,
  bgRemoved: false, originalUrl: null, processedUrl: null,
};

export interface DraftState {
  textValues:      Record<string, string>;
  imageTransforms: Record<string, ImageTransform>;
  paletteId:       string | null;
  vibeId:          string | null;
}

const EMPTY_DRAFT: DraftState = {
  textValues: {}, imageTransforms: {}, paletteId: null, vibeId: null,
};

const DEBOUNCE_MS = 1500;

export function useAITemplateDraft(templateId: string | null | undefined) {
  const [draft, setDraftState] = useState<DraftState>(EMPTY_DRAFT);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = useRef<DraftState>(EMPTY_DRAFT);

  // Keep ref in sync for the debounced save closure
  useEffect(() => { latestDraftRef.current = draft; }, [draft]);

  // Load user + draft on mount
  useEffect(() => {
    if (!templateId) { setLoadingDraft(false); return; }
    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoadingDraft(false); return; }

      setUserId(user.id);

      const { data } = await supabase
        .from('ai_template_drafts')
        .select('text_values, image_transforms, palette_id, vibe_id')
        .eq('user_id', user.id)
        .eq('template_id', templateId)
        .maybeSingle();

      if (!cancelled && data) {
        const loaded: DraftState = {
          textValues:      data.text_values      ?? {},
          imageTransforms: data.image_transforms ?? {},
          paletteId:       data.palette_id       ?? null,
          vibeId:          data.vibe_id          ?? null,
        };
        setDraftState(loaded);
        latestDraftRef.current = loaded;
      }

      if (!cancelled) setLoadingDraft(false);
    })();

    return () => { cancelled = true; };
  }, [templateId]);

  // Debounced save to Supabase
  const scheduleSave = useCallback(() => {
    if (!templateId || !userId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      const d = latestDraftRef.current;
      await supabase
        .from('ai_template_drafts')
        .upsert({
          user_id:          userId,
          template_id:      templateId,
          text_values:      d.textValues,
          image_transforms: d.imageTransforms,
          palette_id:       d.paletteId,
          vibe_id:          d.vibeId,
          updated_at:       new Date().toISOString(),
        }, { onConflict: 'user_id,template_id' });
    }, DEBOUNCE_MS);
  }, [templateId, userId]);

  // Setters — each one updates state and schedules a save
  const setTextValues = useCallback((values: Record<string, string>) => {
    setDraftState(prev => ({ ...prev, textValues: values }));
    scheduleSave();
  }, [scheduleSave]);

  const setOneText = useCallback((id: string, value: string) => {
    setDraftState(prev => {
      const next = { ...prev, textValues: { ...prev.textValues, [id]: value } };
      latestDraftRef.current = next;
      return next;
    });
    scheduleSave();
  }, [scheduleSave]);

  const setImageTransform = useCallback((slotId: string, transform: Partial<ImageTransform>) => {
    setDraftState(prev => {
      const existing = prev.imageTransforms[slotId] ?? DEFAULT_TRANSFORM;
      const next = {
        ...prev,
        imageTransforms: {
          ...prev.imageTransforms,
          [slotId]: { ...existing, ...transform },
        },
      };
      latestDraftRef.current = next;
      return next;
    });
    scheduleSave();
  }, [scheduleSave]);

  const setPaletteId = useCallback((id: string | null) => {
    setDraftState(prev => ({ ...prev, paletteId: id }));
    scheduleSave();
  }, [scheduleSave]);

  const setVibeId = useCallback((id: string | null) => {
    setDraftState(prev => ({ ...prev, vibeId: id }));
    scheduleSave();
  }, [scheduleSave]);

  return {
    draft, loadingDraft,
    setTextValues, setOneText,
    setImageTransform,
    setPaletteId, setVibeId,
  };
}