// src/hooks/useProfile.ts
// Reads and writes the extended profiles table.
// Pre-populates AI template text fields that match known profile field IDs.

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface UserProfile {
  id: string;
  full_name:        string | null;
  display_name:     string | null;
  nickname:         string | null;
  email:            string | null;
  partner_name:     string | null;
  phone:            string | null;
  city:             string | null;
  country:          string | null;
  anniversary_date: string | null; // ISO date string e.g. "2022-06-14"
  birth_date:       string | null;
  bio:              string | null;
  avatar_url:       string | null;
}

const EMPTY_PROFILE: UserProfile = {
  id: '',
  full_name: null, display_name: null, nickname: null,
  email: null, partner_name: null, phone: null,
  city: null, country: null,
  anniversary_date: null, birth_date: null,
  bio: null, avatar_url: null,
};

// Maps known text block IDs to profile fields.
// When a template has a text block whose id matches a key here, we pre-fill it
// with the corresponding profile value so users don't retype it every time.
export const PROFILE_FIELD_MAP: Record<string, keyof UserProfile> = {
  fullname:         'full_name',
  full_name:        'full_name',
  name:             'full_name',
  display_name:     'display_name',
  nickname:         'nickname',
  partner:          'partner_name',
  partner_name:     'partner_name',
  phone:            'phone',
  city:             'city',
  country:          'country',
  anniversary:      'anniversary_date',
  anniversary_date: 'anniversary_date',
  birth_date:       'birth_date',
  birthday:         'birth_date',
  bio:              'bio',
};

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!cancelled) {
        setProfile(data ?? { ...EMPTY_PROFILE, id: user.id, email: user.email ?? null });
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not signed in' };

    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (!error) {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    }
    return { error: error?.message ?? null };
  }, []);

  // Returns a map of text block id → pre-filled value from profile
  // Only returns entries where the profile field is non-null/non-empty
  const getAutofillValues = useCallback(
    (textBlockIds: string[]): Record<string, string> => {
      if (!profile) return {};
      const result: Record<string, string> = {};
      for (const id of textBlockIds) {
        const field = PROFILE_FIELD_MAP[id.toLowerCase()];
        if (field && profile[field]) {
          result[id] = profile[field] as string;
        }
      }
      return result;
    },
    [profile]
  );

  return { profile, loading, updateProfile, getAutofillValues };
}