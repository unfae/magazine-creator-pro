import { supabase } from './supabase';

/**
 * Adds a flag to the DB to mark that this user’s uploaded images
 * associated with the latest export are safe to delete after 10 minutes.
 */
export async function scheduleExportAssetsForDeletion(
  userId: string,
  templateId: string
) {
  const { error } = await supabase
    .from('template_exports')
    .update({
      delete_assets_at: new Date().setMinutes(
        new Date().getMinutes() + 10
      ),
    })
    .eq('user_id', userId)
    .eq('template_id', templateId)
    .is('delete_assets_at', null); // avoid overwriting an already‑scheduled export

  if (error) {
    console.error('Failed to schedule asset deletion:', error);
  }
}
