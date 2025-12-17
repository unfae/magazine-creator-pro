import { supabase } from '@/lib/supabase';

export async function getFeaturedTemplates(limit = 3) {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('is_featured', true)
    .order('featured_order', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data;
}
