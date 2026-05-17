// supabase/functions/generate-text/index.ts
// Calls Claude to fill text fields based on a short user prompt.
// Request:  { templateId, templateName, category, fieldHints, userPrompt }
//   fieldHints: Array<{ id: string; defaultText: string; isLong: boolean }>
// Response: { values: Record<string, string> }

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
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const { templateName, category, fieldHints, userPrompt } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Build the field list for the prompt
    const fieldList = (fieldHints ?? [])
      .map((f: any) =>
        `- id: "${f.id}" | placeholder: "${f.defaultText}" | ${f.isLong ? "paragraph (2-4 sentences)" : "short (under 10 words)"}`
      )
      .join("\n");

    const systemPrompt = `You are a creative writing assistant helping users fill in personalised text for a digital magazine template.
The magazine category is "${category ?? "general"}" and the template is called "${templateName ?? "Magazine"}".
Your job is to generate warm, personalised, natural-sounding text for each field based on the user's prompt.
Respond ONLY with a valid JSON object mapping field id → generated text string. No preamble, no markdown, no explanation.`;

    const userMessage = `User's prompt: "${userPrompt}"

Fields to fill (match these ids exactly in your JSON response):
${fieldList}

Respond only with JSON like: { "fieldId": "generated text", ... }`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5", // Fast + cheap for text fill
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error:", errText);
      return new Response(JSON.stringify({ error: "AI text generation failed." }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const data = await anthropicRes.json();
    const rawText = data.content?.[0]?.text ?? "{}";

    // Strip any accidental markdown fences
    const clean = rawText.replace(/```json|```/g, "").trim();
    let values: Record<string, string> = {};
    try {
      values = JSON.parse(clean);
    } catch {
      console.error("Failed to parse Claude response:", rawText);
    }

    return new Response(JSON.stringify({ values }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});