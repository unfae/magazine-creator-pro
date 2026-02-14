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
        navigate("/dashboard", { replace: true });
      } catch (e: any) {
        toast.error(e?.message || "Payment verification failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reference, navigate]);

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
              onClick={() => navigate("/dashboard")}
              disabled={loading}
            >
              Go to dashboard
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
