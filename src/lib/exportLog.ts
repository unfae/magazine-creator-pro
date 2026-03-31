// src/lib/exportLog.ts

import { supabase } from '@/lib/supabase';

export async function logTemplateExport(params: {
  userId?: string | null;           // nullable — DP guests have no auth
  userEmail?: string | null;
  userName?: string | null;
  templateId?: string | null;
  templateName?: string | null;
  exportType: 'pdf' | 'video' | 'images';
  fileUrl?: string | null;
  pageCount?: number | null;
  isPaidTemplate?: boolean;
  source?: 'standard' | 'dp' | 'ai'; // defaults to 'standard'
  isGuest?: boolean;                  // true when no auth (DP page)
  guestFingerprint?: string | null;   // anonymous session ID for DP guests
  meta?: Record<string, any>;
}) {
  // ── 1. Insert the export log row ──────────────────────────────────────────
  const { error } = await supabase.from('template_exports').insert([{
    user_id:           params.userId            ?? null,
    user_email:        params.userEmail         ?? null,
    user_name:         params.userName          ?? null,
    template_id:       params.templateId        ?? null,
    template_name:     params.templateName      ?? null,
    export_type:       params.exportType,
    file_url:          params.fileUrl           ?? null,
    page_count:        params.pageCount         ?? null,
    source:            params.source            ?? 'standard',
    is_guest:          params.isGuest           ?? false,
    guest_fingerprint: params.guestFingerprint  ?? null,
    meta: {
      ...(params.meta ?? {}),
      ...(params.isPaidTemplate !== undefined ? { isPaidTemplate: params.isPaidTemplate } : {}),
    },
  }]);

  if (error) {
    console.error('Failed to log export:', error);
  }

  // ── 2. Payment tracking — only for authenticated paid-template exports ─────
  // Guest DP exports and free templates skip everything below.
  if (!params.isPaidTemplate || !params.templateId || !params.userId) return;

  // For image exports on iOS, the user downloads one page at a time.
  // Deduplicate within a 5-minute window so we only count one export session,
  // not N exports for N pages.
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
      // Already counted within this 5-minute window — do not increment again
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

// ── Guest fingerprint ─────────────────────────────────────────────────────────
// Generates or retrieves a random session ID stored in sessionStorage.
// Lets you see unique guest downloads in analytics without persistent tracking.
// Clears automatically when the browser tab is closed.

export function getGuestFingerprint(): string {
  const key = 'dp_guest_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}