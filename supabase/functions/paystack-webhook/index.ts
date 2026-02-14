import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function hmacSha512Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );

  // Convert ArrayBuffer -> hex
  const bytes = new Uint8Array(sig);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";

  const secret =
    Deno.env.get("PAYSTACK_WEBHOOK_SECRET") ||
    Deno.env.get("PAYSTACK_SECRET_KEY") ||
    "";

  if (!secret) return new Response("Missing secret", { status: 500 });

  const expected = await hmacSha512Hex(secret, rawBody);

  if (expected !== signature) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event?.event === "charge.success") {
    const reference = event?.data?.reference;

    if (!reference) return new Response("Missing reference", { status: 400 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // IMPORTANT: adjust column name to your schema:
    // If your column is `reference`, keep it.
    // If it's `paystack_reference`, change the eq() column.
    const { error } = await supabase
      .from("template_payments")
      .update({
        status: "success",
        // optionally store the raw event for audit:
        // paystack_event: event,
        updated_at: new Date().toISOString(),
      })
      .eq("reference", reference);

    if (error) return new Response(error.message, { status: 400 });
  }

  return new Response("ok");
});
