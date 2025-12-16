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
        setHasAccess(true); // or keep false; but do NOT block rendering
        return;
      }

      // Free template => always accessible
      if (!templatePay?.price || templatePay.price === 0) {
        setHasAccess(true);
        setLoading(false);
        return;
      }

      // Paid template => must be logged in + have payment record
      const { data: { user } } = await supabase.auth.getUser();
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
    const { data, error } = await supabase.functions.invoke('init-paystack', {
      body: { templateId: templatePay.id, amount: templatePay.price },
    });

    if (error) {
      console.error(error);
      return;
    }

    window.location.href = data.data.authorization_url;
  };

  return { hasTemplateAccess: hasAccess, loading, openPaywall };
}
