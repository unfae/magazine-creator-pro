import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useTemplateAccess(templatePay: any) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      // If template isn't loaded yet, don't block the UI—just wait.
      if (!templatePay) {
        setLoading(false);
        setHasAccess(true);
        return;
      }

      // Free template => always accessible
      if (!templatePay?.price || templatePay.price === 0) {
        setHasAccess(true);
        setLoading(false);
        return;
      }

      // Paid template => must be logged in + have payment record
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) console.error(userErr);

      if (!user) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('template_payments')
        .select('id')
        .eq('user_id', user.id)
        .eq('template_id', templatePay.id)
        .eq('status', 'success')
        .maybeSingle();

      if (error) console.error(error);

      setHasAccess(!!data);
      setLoading(false);
    };

    checkAccess();
  }, [templatePay?.id, templatePay?.price]);

  const openPaywall = async () => {
    if (!templatePay) return;

    // Free template: no paywall
    if (!templatePay?.price || templatePay.price === 0) return;

    // ✅ Ensure user is signed in before calling the Edge Function
    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    if (sessionErr) {
      console.error(sessionErr);
      return;
    }

    if (!session) {
      // Redirect to your auth page (adjust route if yours differs)
      window.location.href = '/auth';
      return;
    }

    const { data, error } = await supabase.functions.invoke('init-paystack', {
      body: { templateId: templatePay.id, amount: templatePay.price },
    });

    if (error) {
      console.error(error);
      return;
    }

    const authorizationUrl = data?.data?.authorization_url;

    if (!authorizationUrl) {
      console.error('init-paystack did not return authorization_url', data);
      return;
    }

    window.location.href = authorizationUrl;
  };

  return { hasTemplateAccess: hasAccess, loading, openPaywall };
}
