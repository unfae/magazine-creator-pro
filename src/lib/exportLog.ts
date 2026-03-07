import { supabase } from '@/lib/supabase';

export async function logTemplateExport(params: {
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  templateId?: string | null;
  templateName?: string | null;
  exportType: 'pdf' | 'video' | 'images';
  fileUrl?: string | null;
  pageCount?: number | null;
  isPaidTemplate?: boolean;
  meta?: Record<string, any>;
}) {
  // Insert the export log row
  const { error } = await supabase.from('template_exports').insert([
    {
      user_id: params.userId,
      user_email: params.userEmail ?? null,
      user_name: params.userName ?? null,
      template_id: params.templateId ?? null,
      template_name: params.templateName ?? null,
      export_type: params.exportType,
      file_url: params.fileUrl ?? null,
      page_count: params.pageCount ?? null,
      meta: params.meta ?? {},
    },
  ]);

  if (error) {
    console.error('Failed to log export:', error);
  }

  // If not a paid template, nothing else to do
  if (!params.isPaidTemplate || !params.templateId || !params.userId) return;

  // For image exports: check if there's already an export in the last 5 minutes
  // (iPhone exports one image at a time, so we batch them into one export count)
  if (params.exportType === 'images') {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentExport } = await supabase
      .from('template_exports')
      .select('id')
      .eq('user_id', params.userId)
      .eq('template_id', params.templateId)
      .eq('export_type', 'images')
      .gte('created_at', fiveMinutesAgo)
      .maybeSingle();

    if (recentExport) {
      // Already counted within this window — do not increment
      return;
    }
  }

  // Increment exports_used on the user's payment row for this template
  const { data: payment } = await supabase
    .from('template_payments')
    .select('id, exports_used, max_exports')
    .eq('user_id', params.userId)
    .eq('template_id', params.templateId)
    .eq('status', 'success')
    .maybeSingle();

  if (!payment) return;

  await supabase
    .from('template_payments')
    .update({ exports_used: (payment.exports_used ?? 0) + 1 })
    .eq('id', payment.id);
}