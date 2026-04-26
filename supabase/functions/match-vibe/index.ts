// supabase/functions/match-vibe/index.ts
// Given a free-text user prompt and the list of available vibes for a template,
// calls Claude to pick the best matching vibe ID.
// Degrades gracefully if ANTHROPIC_API_KEY is not set — returns 503 so the
// UI can fall back to manual selection without showing an error to the user.

import { serve } from "https://deno.land/std/http/server.ts";

const ALLOWED_ORIGINS = new Set([
  "https://magzinemaker.vercel.app",
  "https://magznmaker.com",
  "https://www.magznmaker.com",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers });

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    // Not configured yet — tell the client to fall back to manual selection
    return new Response(
      JSON.stringify({ error: "AI matching not configured yet", notConfigured: true }),
      { status: 503, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  try {
    const { templateName, category, userPrompt, vibeOptions } = await req.json();

    if (!userPrompt || !Array.isArray(vibeOptions) || vibeOptions.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing userPrompt or vibeOptions" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const vibeList = vibeOptions
      .map((v: any) => `- id: "${v.id}" | name: "${v.name}" | description: "${v.description ?? ''}"`)
      .join("\n");

    const systemPrompt = `You are a design assistant helping match a user's mood description to the best visual style (called a "vibe") for a digital magazine template.
Respond ONLY with a JSON object containing a single key "vibeId" whose value is the id of the best matching vibe.
No explanation, no markdown, just: { "vibeId": "the-matching-id" }`;

    const userMessage = `The magazine template is "${templateName ?? "Magazine"}" in the "${category ?? "general"}" category.

The user described what they want it to feel like:
"${userPrompt}"

Available vibes to choose from:
${vibeList}

Pick the single best match and return its id.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 64,   // Only needs to return a tiny JSON object
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error:", errText);
      return new Response(
        JSON.stringify({ error: "AI matching failed" }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const data    = await anthropicRes.json();
    const rawText = data.content?.[0]?.text ?? "{}";
    const clean   = rawText.replace(/```json|```/g, "").trim();

    let vibeId: string | null = null;
    try {
      const parsed = JSON.parse(clean);
      vibeId = parsed.vibeId ?? null;
    } catch {
      console.error("Failed to parse vibe match response:", rawText);
    }

    if (!vibeId) {
      return new Response(
        JSON.stringify({ error: "Could not determine a match" }),
        { status: 422, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ vibeId }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});