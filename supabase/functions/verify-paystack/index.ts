import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set<string>([
  "https://magzinemaker.vercel.app",
  "https://www.magznmaker.com",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = allowedOrigins.has(origin) ? origin : origin;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

serve(async (req) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers });
  }

  try {
    const { reference } = await req.json();

    if (!reference || typeof reference !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "Missing or invalid reference" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      return new Response(JSON.stringify({ ok: false, error: "Missing PAYSTACK_SECRET_KEY" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // 1) Verify with Paystack
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
      }
    );

    const verifyJson = await verifyRes.json();

    if (!verifyRes.ok || verifyJson.status !== true) {
      return new Response(
        JSON.stringify({ ok: false, error: "Paystack verification failed", details: verifyJson }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const paystackData = verifyJson.data;
    if (!paystackData || paystackData.status !== "success") {
      return new Response(
        JSON.stringify({ ok: false, error: "Payment not successful", details: paystackData }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2) Mark payment as success and get the row back
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("template_payments")
      .update({
        status: "success",
        provider_reference: reference,
        updated_at: new Date().toISOString(),
      })
      .eq("provider_reference", reference)
      .select("id, discount_code_id")
      .limit(1);

    if (updateErr) {
      return new Response(JSON.stringify({ ok: false, error: updateErr.message }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // 3) If a discount code was used, increment its uses_count
    const payment = updated?.[0];
    if (payment?.discount_code_id) {
      const { data: codeRow } = await supabaseAdmin
        .from("template_discount_codes")
        .select("uses_count")
        .eq("id", payment.discount_code_id)
        .single();

      if (codeRow) {
        await supabaseAdmin
          .from("template_discount_codes")
          .update({ uses_count: codeRow.uses_count + 1 })
          .eq("id", payment.discount_code_id);
      }
    }

    return new Response(JSON.stringify({ ok: true, payment: payment ?? null }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});