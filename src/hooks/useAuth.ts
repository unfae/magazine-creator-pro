// src/hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const [user, setUser] = useState(supabase.auth.getUser ? null : null);

  useEffect(() => {
    // initial fetch
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));

    const { subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function refreshProfile() {
    if (!user) return null;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    return data;
  }

  return { user, refreshProfile };
}
