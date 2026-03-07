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
  // ✅ Reads templateSlug from URL (set by init-paystack in callback_url)
  const urlTemplateSlug = params.get("templateSlug");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!reference) {
          toast.error("Missing payment reference.");
          return;
        }

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

        if (!data?.ok) {
          throw new Error(data?.error || "Unable to verify payment.");
        }

        toast.success("Payment verified. Template unlocked!");

        // Redirect priority:
        //   1. templateSlug from URL query param (most reliable — set by init-paystack)
        //   2. pending_template_slug from localStorage (backup in case Paystack strips query params)
        //   3. Dashboard fallback — DO NOT fall back to pending_template_id (UUID) since
        //      routes are now slug-based and /create/<uuid> will 404 with "Template not found"
        const localSlug = localStorage.getItem("pending_template_slug");

        localStorage.removeItem("pending_template_slug");
        localStorage.removeItem("pending_template_id");  // clear legacy key too

        let destination = "/dashboard";

        if (urlTemplateSlug) {
          destination = `/create/${urlTemplateSlug}`;
        } else if (localSlug) {
          destination = `/create/${localSlug}`;
        }
        // ✅ No UUID fallback — if we have no slug at all, go to dashboard
        //    rather than trying /create/<uuid> which breaks slug-based routing

        if (!cancelled) {
          navigate(destination, { replace: true });
        }
      } catch (e: any) {
        toast.error(e?.message || "Payment verification failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
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
                // Manual navigation button — same priority: slug from URL or localStorage
                const slug =
                  urlTemplateSlug || localStorage.getItem("pending_template_slug");
                const destination = slug ? `/create/${slug}` : "/dashboard";
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
