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

      // Free template (or 100% discount override from CreateMagazinePage) — always accessible.
      // CreateMagazinePage passes { ...template, price: 0 } when a 100% discount code is applied,
      // which triggers this branch and grants access instantly without touching Paystack.
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
  }, [templatePay?.id, templatePay?.price]);  // re-runs when price changes (catches 100% discount override)

  // openPaywall accepts:
  //   discountCode — validated code string, passed to init-paystack for server-side re-validation
  //   finalAmount  — pre-calculated discounted price from CreateMagazinePage:
  //                  • undefined  → charges original template price
  //                  • > 0        → charges the discounted amount
  //                  • === 0      → should NOT reach here — CreateMagazinePage handles 100%
  //                                 discounts via the price=0 trick before calling openPaywall
  const openPaywall = async (discountCode?: string, finalAmount?: number) => {
    if (!templatePay) return;
    if (!templatePay?.price || templatePay.price === 0) return;  // free template or 100% discount override — no-op

    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

    if (sessionErr) {
      console.error(sessionErr);
      return;
    }

    if (!session) {
      window.location.href = "/auth";
      return;
    }

    // Store slug as backup — CreateMagazinePage also calls setSlugBeforePaywall() which is the
    // primary source. This hook-level write is the fallback in case the component-level one is missed.
    if (templatePay.slug) {
      localStorage.setItem("pending_template_slug", templatePay.slug);
    }

    try {
      const { data, error } = await supabase.functions.invoke("init-paystack", {
        body: {
          templateId: templatePay.id,
          templateSlug: templatePay.slug,        // used in Paystack callback URL
          // ✅ Use finalAmount if provided (discount applied), else fall back to original price
          amount: finalAmount ?? templatePay.price,
          ...(discountCode ? { discountCode } : {}),
        },
      });

      if (error) throw error;

      // ✅ 100% discount safety net: init-paystack inserted a success record directly.
      //    Normally this is handled before openPaywall is called (price=0 trick in CreateMagazinePage),
      //    but if somehow amount=0 reaches here, clean up and navigate back to the template.
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
