import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Video export access rules:
//   • Paid template (price > 0) — video is free, granted when template payment succeeds
//     (verify-paystack sets video_unlocked = true on the template payment row)
//   • Free template (price = 0) — costs ₦1,000, stored as a separate payment row
//     with payment_purpose = 'video' and video_unlocked = true

export function useVideoAccess(template: any) {
  const [hasVideoAccess, setHasVideoAccess] = useState(false);
  const [checkingVideo, setCheckingVideo] = useState(true);

  useEffect(() => {
    if (!template?.id) {
      setCheckingVideo(false);
      return;
    }

    const check = async () => {
      setCheckingVideo(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHasVideoAccess(false);
        setCheckingVideo(false);
        return;
      }

      const isPaidTemplate = (template?.price ?? 0) > 0;

      if (isPaidTemplate) {
        // Paid template: look for a successful template payment with video_unlocked = true
        const { data } = await supabase
          .from('template_payments')
          .select('id')
          .eq('user_id', user.id)
          .eq('template_id', template.id)
          .eq('status', 'success')
          .eq('video_unlocked', true)
          .maybeSingle();

        setHasVideoAccess(!!data);
      } else {
        // Free template: look for a successful video-specific payment row
        const { data } = await supabase
          .from('template_payments')
          .select('id')
          .eq('user_id', user.id)
          .eq('template_id', template.id)
          .eq('status', 'success')
          .eq('payment_purpose', 'video')
          .maybeSingle();

        setHasVideoAccess(!!data);
      }

      setCheckingVideo(false);
    };

    check();
  }, [template?.id, template?.price]);

  return { hasVideoAccess, checkingVideo };
}
