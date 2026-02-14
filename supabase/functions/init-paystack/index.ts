import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set<string>([
  "https://magzinemaker.vercel.app",
  "https://magznmaker.com",
  "https://www.magznmaker.com",
  "http://localhost:5173",
  "http://localhost:3000"
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = allowedOrigins.has(origin) ? origin : origin;

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin"
  };
}

function decodeJwtPayload(jwt: string): any | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  const payload = parts[1];

  const padded = payload.padEnd(
    payload.length + ((4 - (payload.length % 4)) % 4),
    "="
  );

  const json = new TextDecoder().decode(
    Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
  );

  return JSON.parse(json);
}

serve(async (req) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...headers, "Content-Type": "application/json" }
      }
    );
  }

  try {
    const { templateId, amount } = await req.json();

    if (!templateId || amount == null) {
      return new Response(
        JSON.stringify({ error: "Missing templateId or amount" }),
        {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" }
        }
      );
    }

    // 1) Read JWT from Authorization header (if present)
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...headers, "Content-Type": "application/json" }
        }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing JWT token after Bearer" }),
        {
          status: 401,
          headers: { ...headers, "Content-Type": "application/json" }
        }
      );
    }

    const payload = decodeJwtPayload(token);
    if (!payload || !payload.sub) {
      return new Response(
        JSON.stringify({ error: "Invalid JWT payload" }),
        {
          status: 401,
          headers: { ...headers, "Content-Type": "application/json" }
        }
      );
    }

    const userId = payload.sub as string;
    const userEmail =
      (payload.email as string | undefined) ??
      (payload.user_metadata?.email as string | undefined);

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "Missing email in JWT" }),
        {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" }
        }
      );
    }

    // 2) Admin client for DB writes (bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const reference = crypto.randomUUID();

    const { error: insertErr } = await supabaseAdmin
      .from("template_payments")
      .insert({
        user_id: userId,
        template_id: templateId,
        provider: "paystack",
        provider_reference: reference,
        amount,
        status: "pending"
      });

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        {
          status: 500,
          headers: { ...headers, "Content-Type": "application/json" }
        }
      );
    }

    // 3) Initialize Paystack transaction
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      return new Response(
        JSON.stringify({ error: "Missing PAYSTACK_SECRET_KEY" }),
        {
          status: 500,
          headers: { ...headers, "Content-Type": "application/json" }
        }
      );
    }

    const res = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: userEmail,
          amount: Math.round(Number(amount) * 100),
          reference,
          callback_url:
            "https://www.magznmaker.com/templatepayment/callback",
          metadata: {
            template_id: templateId,
            user_id: userId
          }
        })
      }
    );

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: res.ok ? 200 : 400,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }
});
