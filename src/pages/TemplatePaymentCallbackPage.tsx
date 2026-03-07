import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TemplatePaymentCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  const reference = params.get("reference");

  useEffect(() => {
    if (!reference) {
      setStatus("error");
      setErrorMsg("No payment reference found.");
      return;
    }

    (async () => {
      try {
        // 1. Check session
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          navigate("/auth?mode=login", { replace: true });
          return;
        }

        // 2. Call verify-paystack
        const { data, error } = await supabase.functions.invoke("verify-paystack", {
          body: { reference },
        });

        if (error) throw new Error(error.message);
        if (!data?.ok) throw new Error(data?.error || "Payment verification failed.");

        toast.success("Payment verified! Template unlocked.");

        // 3. Get slug — verify-paystack returns it directly from DB (most reliable)
        const slug: string | null = data?.templateSlug ?? null;

        if (slug) {
          navigate(`/create/${slug}`, { replace: true });
          return;
        }

        // 4. Fallback: look up slug from template_id on the payment row
        const templateId: string | null = data?.payment?.template_id ?? null;
        if (templateId) {
          const { data: tmpl } = await supabase
            .from("templates")
            .select("slug")
            .eq("id", templateId)
            .maybeSingle();

          if (tmpl?.slug) {
            navigate(`/create/${tmpl.slug}`, { replace: true });
            return;
          }
        }

        // 5. Last resort
        navigate("/dashboard", { replace: true });

      } catch (e: any) {
        setStatus("error");
        setErrorMsg(e?.message || "Something went wrong.");
        toast.error(e?.message || "Payment verification failed.");
      }
    })();
  }, [reference]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {status === "error" ? "Payment Error" : "Confirming payment…"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "error" ? (
            <p className="text-sm text-destructive">{errorMsg}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Please wait while we verify your payment…
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard", { replace: true })}
            >
              Go to Dashboard
            </Button>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}