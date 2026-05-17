import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set<string>([
  "https://magzinemaker.vercel.app",
  "https://magznmaker.com",
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

function decodeJwtPayload(jwt: string): any | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  const payload = parts[1];
  const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
  const json = new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
  return JSON.parse(json);
}

serve(async (req) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const { templateId, templateSlug, amount, discountCode, videoOnly } = await req.json();

    if (!templateId || amount == null) {
      return new Response(JSON.stringify({ error: "Missing templateId or amount" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const payload = decodeJwtPayload(token);
    if (!payload?.sub) {
      return new Response(JSON.stringify({ error: "Invalid JWT payload" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const userId = payload.sub as string;
    const userEmail =
      (payload.email as string | undefined) ??
      (payload.user_metadata?.email as string | undefined);

    if (!userEmail) {
      return new Response(JSON.stringify({ error: "Missing email in JWT" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // The client has already calculated and validated the discounted amount before calling
    // this function — so we use `amount` as-is. If a discountCode was provided, we look
    // it up only to record its ID for tracking (uses_count is incremented by verify-paystack).
    // We do NOT re-apply the discount math here to avoid double-discounting.
    let finalAmount = Number(amount);
    let discountCodeId: string | null = null;
    let originalAmount: number | null = null;

    if (discountCode && typeof discountCode === "string") {
      const { data: codeRow } = await supabaseAdmin
        .from("template_discount_codes")
        .select("id")
        .eq("code", discountCode.trim().toUpperCase())
        .eq("template_id", templateId)
        .eq("is_active", true)
        .maybeSingle();

      // Record the code ID for tracking — validation already happened client-side
      discountCodeId = codeRow?.id ?? null;

      // Fetch the real original price from the templates table so original_amount
      // always reflects the full price before any discount was applied.
      if (discountCodeId) {
        const { data: tmplRow } = await supabaseAdmin
          .from("templates")
          .select("price")
          .eq("id", templateId)
          .maybeSingle();
        originalAmount = tmplRow?.price != null ? Number(tmplRow.price) : null;
      }
    }

    // ✅ 100% discount path — skip Paystack entirely
    // Insert a success payment record directly and return { free: true }
    // so the client can redirect straight back to the template without a payment page
    if (finalAmount === 0) {
      const { error: insertErr } = await supabaseAdmin
        .from("template_payments")
        .insert({
          user_id: userId,
          template_id: templateId,
          provider: "free",                  // marks this as a free/discounted unlock
          provider_reference: crypto.randomUUID(),
          amount: 0,
          original_amount: originalAmount,
          discount_code_id: discountCodeId,
          status: "success",                 // granted immediately — no payment needed
        });

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      // Increment discount code uses_count since verify-paystack won't run for free unlocks
      if (discountCodeId) {
        const { data: codeRow } = await supabaseAdmin
          .from("template_discount_codes")
          .select("uses_count")
          .eq("id", discountCodeId)
          .single();

        if (codeRow) {
          await supabaseAdmin
            .from("template_discount_codes")
            .update({ uses_count: codeRow.uses_count + 1 })
            .eq("id", discountCodeId);
        }
      }

      // Return free flag — client will navigate directly to the template
      return new Response(JSON.stringify({ free: true }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Standard paid path — initialize Paystack transaction
    const reference = crypto.randomUUID();

    const { error: insertErr } = await supabaseAdmin
      .from("template_payments")
      .insert({
        user_id: userId,
        template_id: templateId,
        provider: "paystack",
        provider_reference: reference,
        amount: finalAmount,
        original_amount: originalAmount,
        discount_code_id: discountCodeId,
        status: "pending",
        payment_purpose: videoOnly ? "video" : "template",
        video_unlocked: videoOnly ? true : false,  // video payments are pre-approved; template payments get set by verify-paystack
      });

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      return new Response(JSON.stringify({ error: "Missing PAYSTACK_SECRET_KEY" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Always look up the slug from the DB — never rely solely on the client sending it.
    // If the client sent templateSlug we use it directly; otherwise we fetch it.
    // This guarantees the callback URL always contains the real slug, never a UUID.
    let resolvedSlug: string | null = templateSlug ?? null;
    if (!resolvedSlug) {
      const { data: tmplRow } = await supabaseAdmin
        .from("templates")
        .select("slug")
        .eq("id", templateId)
        .single();
      resolvedSlug = tmplRow?.slug ?? null;
    }

    // Use resolved slug in callback URL; fall back to templateId only if slug is truly missing
    const callbackIdentifier = resolvedSlug ?? templateId;
    // videoOnly payments return to same template page; template payments use the callback page
    // Both payment types return directly to the template page.
    // CreateMagazinePage detects ?verify= (template) or ?videoVerify=true (video)
    // and calls verify-paystack inline — no separate callback page needed.
    const callbackUrl = videoOnly
      ? `https://www.magznmaker.com/create/${callbackIdentifier}?videoVerify=true`
      : `https://www.magznmaker.com/create/${callbackIdentifier}?verify=${reference}`;

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: userEmail,
        amount: Math.round(finalAmount * 100),  // Paystack expects kobo (amount * 100)
        reference,
        callback_url: callbackUrl,
        metadata: { template_id: templateId, template_slug: templateSlug, user_id: userId },
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: res.ok ? 200 : 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});