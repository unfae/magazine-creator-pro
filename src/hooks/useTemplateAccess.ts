import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';


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
    if (!templatePay?.price || templatePay.price === 0) return;

    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    console.log('session from client', session, sessionErr);

    if (sessionErr) {
      console.error(sessionErr);
      return;
    }

    if (!session) {
      window.location.href = '/auth';
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('init-paystack', {
        body: { templateId: templatePay.id, amount: templatePay.price },
      });

      if (error) throw error;

      const authorizationUrl = data?.data?.authorization_url;

      if (!authorizationUrl) {
        console.error('init-paystack did not return authorization_url', data);
        return;
      }

      window.location.href = authorizationUrl;
    } catch (e: any) {
      if (e instanceof FunctionsHttpError) {
        const errorBody = await e.context.json();
        console.error('init-paystack HTTP error', e.status, errorBody);
      } else {
        console.error(e);
      }
    }
  };



  return { hasTemplateAccess: hasAccess, loading, openPaywall };
}
