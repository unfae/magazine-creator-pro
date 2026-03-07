import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TemplatePaymentCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const reference = params.get("reference");

  // ✅ Read slug from URL — set by init-paystack in the callback_url query param
  const urlTemplateSlug = params.get("templateSlug");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!reference) {
          toast.error("Missing payment reference.");
          return;
        }

        // Must be logged in so we can associate/confirm access cleanly
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          toast.error("Please sign in to complete payment verification.");
          navigate(`/auth?mode=login`, { replace: true });
          return;
        }

        const { data, error } = await supabase.functions.invoke("verify-paystack", {
          body: { reference },
        });

        if (error) throw error;

        // Expect verify-paystack to return { ok: true }
        if (!data?.ok) {
          throw new Error(data?.error || "Unable to verify payment.");
        }

        toast.success("Payment verified. Template unlocked!");

        // Redirect priority — cascade until we find something usable:
        //   1. templateSlug from URL query param (most reliable — put there by init-paystack)
        //   2. pending_template_slug from localStorage (backup set by useTemplateAccess)
        //   3. pending_template_id from localStorage (legacy fallback — UUID)
        //      Note: /create/<uuid> won't resolve with slug-based routing, but it's a last
        //      resort so the user at least lands somewhere meaningful rather than dashboard.
        //   4. /dashboard if nothing is available at all
        const localSlug = localStorage.getItem("pending_template_slug");
        const localId   = localStorage.getItem("pending_template_id");

        // Always clean up both keys after reading
        localStorage.removeItem("pending_template_slug");
        localStorage.removeItem("pending_template_id");

        let destination = "/dashboard";

        if (urlTemplateSlug) {
          // Best case: slug came back in the Paystack callback URL
          destination = `/create/${urlTemplateSlug}`;
        } else if (localSlug) {
          // Good case: slug was saved to localStorage before Paystack redirect
          destination = `/create/${localSlug}`;
        } else if (localId) {
          // Legacy fallback: old code stored the UUID — try it anyway
          destination = `/create/${localId}`;
        }

        if (!cancelled) {
          navigate(destination, { replace: true });
        }
      } catch (e: any) {
        toast.error(e?.message || "Payment verification failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reference, urlTemplateSlug, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Confirming payment…</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {reference ? `Reference: ${reference}` : "No reference found."}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                // Manual navigation — same priority order as the auto-redirect above
                const slug = urlTemplateSlug || localStorage.getItem("pending_template_slug");
                const id   = localStorage.getItem("pending_template_id");
                const destination = slug
                  ? `/create/${slug}`
                  : id
                  ? `/create/${id}`
                  : "/dashboard";
                navigate(destination, { replace: true });
              }}
              disabled={loading}
            >
              Go to template
            </Button>

            <Button onClick={() => window.location.reload()} disabled={loading}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
