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

  // Paystack puts whatever was in callback_url back into the URL.
  // Problem: init-paystack sometimes falls back to templateId (UUID) instead of the slug
  // when templateSlug wasn't passed by the client. We detect that case here and resolve
  // the real slug from the DB so CreateMagazinePage never gets a UUID as a slug.
  const urlTemplateParam = params.get("templateSlug"); // may be a slug OR a UUID

  // UUID regex — if it matches, we need to resolve it to a slug
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const urlIsUUID = !!urlTemplateParam && UUID_RE.test(urlTemplateParam);

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

        if (!data?.ok) {
          throw new Error(data?.error || "Unable to verify payment.");
        }

        toast.success("Payment verified. Template unlocked!");

        const responseSlug: string | null = data?.templateSlug ?? null;
        const localSlug = localStorage.getItem("pending_template_slug");
        const localId   = localStorage.getItem("pending_template_id");

        // 🔍 DEBUG — persists to localStorage so it survives the navigation
        const debugInfo = {
          responseSlug,
          urlTemplateParam,
          urlIsUUID,
          localSlug,
          localId,
          fullData: data,
        };
        console.log("[redirect debug]", debugInfo);
        localStorage.setItem("__redirect_debug__", JSON.stringify(debugInfo));

        localStorage.removeItem("pending_template_slug");
        localStorage.removeItem("pending_template_id");

        let resolvedSlug: string | null = null;

        if (responseSlug) {
          resolvedSlug = responseSlug;
        } else if (urlTemplateParam && !urlIsUUID) {
          resolvedSlug = urlTemplateParam;
        } else if (localSlug) {
          resolvedSlug = localSlug;
        } else {
          const idToResolve = (urlIsUUID ? urlTemplateParam : null) ?? localId ?? null;
          if (idToResolve) {
            const { data: tmpl } = await supabase
              .from("templates")
              .select("slug")
              .eq("id", idToResolve)
              .maybeSingle();
            resolvedSlug = tmpl?.slug ?? null;
            console.log("[redirect debug] DB slug lookup result:", resolvedSlug, "for id:", idToResolve);
          }
        }

        console.log("[redirect debug] final resolvedSlug:", resolvedSlug);
        const destination = resolvedSlug ? `/create/${resolvedSlug}` : "/dashboard";

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
  }, [reference, urlTemplateParam, navigate]);

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
              onClick={async () => {
                // Same resolution priority as the auto-redirect
                const localSlug = localStorage.getItem("pending_template_slug");
                const localId   = localStorage.getItem("pending_template_id");

                let resolvedSlug: string | null = null;

                if (urlTemplateParam && !urlIsUUID) {
                  resolvedSlug = urlTemplateParam;
                } else if (localSlug) {
                  resolvedSlug = localSlug;
                } else {
                  const idToResolve = (urlIsUUID ? urlTemplateParam : null) ?? localId ?? null;
                  if (idToResolve) {
                    const { data: tmpl } = await supabase
                      .from("templates")
                      .select("slug")
                      .eq("id", idToResolve)
                      .maybeSingle();
                    resolvedSlug = tmpl?.slug ?? null;
                  }
                }

                const destination = resolvedSlug ? `/create/${resolvedSlug}` : "/dashboard";
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
