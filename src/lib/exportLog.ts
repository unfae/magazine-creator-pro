export async function logTemplateExport(params: {
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  templateId?: string | null;
  templateName?: string | null;
  exportType: 'pdf' | 'video' | 'images';
  fileUrl?: string | null;
  pageCount?: number | null;
  meta?: Record<string, any>;
}) {
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
    // Don't block the export UX if logging fails
    console.error('Failed to log export:', error);
  }
}
