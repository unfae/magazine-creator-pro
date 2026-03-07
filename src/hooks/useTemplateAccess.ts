import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { FunctionsHttpError } from "@supabase/supabase-js";

export function useTemplateAccess(templatePay: any) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportsUsed, setExportsUsed] = useState(0);
  const [maxExports, setMaxExports] = useState(7);

  const exportLimitReached = hasAccess && exportsUsed >= maxExports;
  const remainingExports = Math.max(0, maxExports - exportsUsed);

  useEffect(() => {
    const checkAccess = async () => {
      // If template isn't loaded yet, don't block the UI — just wait.
      if (!templatePay) {
        setLoading(false);
        setHasAccess(true);
        return;
      }

      // Free template — always accessible, no export limits
      if (!templatePay?.price || templatePay.price === 0) {
        setHasAccess(true);
        setLoading(false);
        return;
      }

      // Paid template => must be logged in + have a successful payment record
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) console.error(userErr);

      if (!user) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("template_payments")
        .select("id, exports_used, max_exports")
        .eq("user_id", user.id)
        .eq("template_id", templatePay.id)
        .eq("status", "success")
        .maybeSingle();

      if (error) console.error(error);

      if (data) {
        setHasAccess(true);
        setExportsUsed(data.exports_used ?? 0);
        setMaxExports(data.max_exports ?? 7);
      } else {
        setHasAccess(false);
      }

      setLoading(false);
    };

    checkAccess();
  }, [templatePay?.id, templatePay?.price]);

  // openPaywall accepts:
  //   discountCode  — validated code string, passed to init-paystack for server-side re-validation
  //   finalAmount   — pre-calculated discounted price from the UI:
  //                   • if undefined  → charges original template price via Paystack
  //                   • if > 0        → charges the discounted amount via Paystack
  //                   • if === 0      → 100% discount; init-paystack inserts a success record
  //                                     directly and returns { free: true } — no Paystack redirect
  const openPaywall = async (discountCode?: string, finalAmount?: number) => {
    if (!templatePay) return;
    if (!templatePay?.price || templatePay.price === 0) return;

    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

    if (sessionErr) {
      console.error(sessionErr);
      return;
    }

    if (!session) {
      window.location.href = "/auth";
      return;
    }

    // Store slug as backup in case Paystack strips query params from callback URL
    if (templatePay.slug) {
      localStorage.setItem("pending_template_slug", templatePay.slug);
    }

    try {
      const { data, error } = await supabase.functions.invoke("init-paystack", {
        body: {
          templateId: templatePay.id,
          templateSlug: templatePay.slug,        // used in callback URL
          // ✅ Use finalAmount if provided (discount applied), else fall back to original price
          amount: finalAmount ?? templatePay.price,
          ...(discountCode ? { discountCode } : {}),
        },
      });

      if (error) throw error;

      // ✅ 100% discount path: init-paystack inserted a success record directly — no Paystack needed
      // Just clean up localStorage and navigate straight back to the template
      if (data?.free === true) {
        localStorage.removeItem("pending_template_slug");
        localStorage.removeItem("pending_template_id");
        window.location.href = `/create/${templatePay.slug}`;
        return;
      }

      const authorizationUrl = data?.data?.authorization_url;

      if (!authorizationUrl) {
        console.error("init-paystack did not return authorization_url", data);
        return;
      }

      window.location.href = authorizationUrl;
    } catch (e: any) {
      if (e instanceof FunctionsHttpError) {
        const errorBody = await e.context.json();
        console.error("init-paystack HTTP error", e.status, errorBody);
      } else {
        console.error(e);
      }
    }
  };

  return {
    hasTemplateAccess: hasAccess,
    loading,
    openPaywall,       // signature: openPaywall(discountCode?: string, finalAmount?: number)
    exportsUsed,
    maxExports,
    remainingExports,
    exportLimitReached,
  };
}
