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

  // Optionally read templateId from URL (Paystack may strip it, but it's harmless to keep)
  const reference = params.get("reference");
  const urlTemplateId = params.get("templateId");

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

        // Expect verify-paystack to return { ok: true } or similar
        if (!data?.ok) {
          throw new Error(data?.error || "Unable to verify payment.");
        }

        toast.success("Payment verified. Template unlocked!");

        // Decide where to redirect
        let templateId = urlTemplateId;

        // If URL doesn't have it, try localStorage (set in useTemplateAccess before opening Paystack)
        if (!templateId) {
          templateId = localStorage.getItem("pending_template_id");
        }

        // Clear the stored templateId after use
        localStorage.removeItem("pending_template_id");

        let destination = "/dashboard";

        if (templateId) {
          // Use your existing template edit route:
          destination = `/create/${templateId}`;
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
  }, [reference, urlTemplateId, navigate]);

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
                // If they close browser mid-flow, send them to the template or fallback
                const storedId = localStorage.getItem("pending_template_id");
                const destination = storedId ? `/create/${storedId}` : "/dashboard";
                navigate(destination, { replace: true });
              }}
              disabled={loading}
            >
              Go to template
            </Button>

            <Button
              onClick={() => window.location.reload()}
              disabled={loading}
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
