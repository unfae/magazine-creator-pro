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
    const { templateId, templateSlug, amount, discountCode } = await req.json();

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

    // Validate discount code if provided
    let finalAmount = Number(amount);
    let discountCodeId: string | null = null;
    let originalAmount: number | null = null;

    if (discountCode && typeof discountCode === "string") {
      const { data: codeRow, error: codeErr } = await supabaseAdmin
        .from("template_discount_codes")
        .select("*")
        .eq("code", discountCode.trim().toUpperCase())
        .eq("template_id", templateId)
        .eq("is_active", true)
        .maybeSingle();

      if (codeErr || !codeRow) {
        return new Response(JSON.stringify({ error: "Invalid or expired discount code" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Discount code has expired" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      if (codeRow.max_uses !== null && codeRow.uses_count >= codeRow.max_uses) {
        return new Response(JSON.stringify({ error: "Discount code has reached its usage limit" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      originalAmount = finalAmount;
      discountCodeId = codeRow.id;

      if (codeRow.discount_type === "percent") {
        finalAmount = finalAmount * (1 - codeRow.discount_value / 100);
      } else {
        finalAmount = Math.max(0, finalAmount - codeRow.discount_value);
      }

      finalAmount = Math.round(finalAmount * 100) / 100;
    }

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

    // Use slug in callback URL if available, fall back to templateId
    const callbackIdentifier = templateSlug ?? templateId;
    const callbackUrl = `https://www.magznmaker.com/templatepayment/callback?templateSlug=${callbackIdentifier}`;

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: userEmail,
        amount: Math.round(finalAmount * 100),
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