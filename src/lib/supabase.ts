import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

supabase.auth.onAuthStateChange(() => {
  // forces supabase to persist session in local storage
});


export const supabase = createClient(supabaseUrl, supabaseAnonKey);
