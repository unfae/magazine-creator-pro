// supabase/functions/generate-foundation/index.ts
// Takes a magazine brief and returns per-page creative foundations.
// Output: creative prompt, per-page titles + visual metaphors + directions.

import { serve } from "https://deno.land/std/http/server.ts";

const ALLOWED_ORIGINS = new Set([
  "https://magzinemaker.vercel.app", "https://magznmaker.com",
  "https://www.magznmaker.com", "http://localhost:5173", "http://localhost:3000",
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

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 503, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const {
      magazineType, magazineTitle, magazineDescription, targetAudience, magazineAim,
      pageConceptIdeas, accentColorHint, typographyFamilies, wordMaskWord,
      wordMaskType, wordMaskDirection, pageCount,
    } = await req.json();

    if (!magazineTitle || !pageCount) {
      return new Response(JSON.stringify({ error: "Missing magazineTitle or pageCount" }), {
        status: 400, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a senior magazine art director and creative director.
You create precise, evocative creative foundations for magazine layouts.
Your output is a structured JSON object — nothing else. No preamble, no markdown fences.`;

    const userMessage = `Create a complete creative foundation for a magazine with these details:

MAGAZINE_TYPE: ${magazineType ?? "Personal"}
MAGAZINE_TITLE: ${magazineTitle}
MAGAZINE_DESCRIPTION: ${magazineDescription ?? ""}
TARGET_AUDIENCE: ${targetAudience ?? ""}
MAGAZINE_AIM: ${magazineAim ?? ""}
PAGE_CONCEPT_IDEAS: ${pageConceptIdeas ?? ""}
ACCENT_COLOR_HINT: ${accentColorHint ?? ""}
TYPOGRAPHY_FAMILIES: ${JSON.stringify(typographyFamilies ?? {})}
WORD_MASK_WORD: ${wordMaskWord ?? ""}
WORD_MASK_TYPE: ${wordMaskType ?? "single line"}
WORD_MASK_DIRECTION: ${wordMaskDirection ?? "horizontal"}
TOTAL_PAGES: ${pageCount}

Respond ONLY with this exact JSON structure:

{
  "creativePrompt": "A 3–5 sentence creative brief for a photographer/designer. Covers mood, palette direction, visual language.",
  "overallMood": "2–4 words",
  "colorDirection": "Short description of colour palette and reasoning",
  "typographyDirection": "Short description of type pairings and usage",
  "pages": [
    {
      "pageNumber": 1,
      "title": "Short editorial page title (2–5 words)",
      "direction": "1–2 sentences: what this page shows, how it feels, what the reader experiences",
      "visualMetaphor": "The dominant visual idea for this page — one strong concrete image or concept",
      "suggestedLayout": "Cover / Full-bleed portrait / Split / Text-heavy / Collage / Word-mask / Minimal / etc.",
      "textHints": ["Short hint for any text field on this page"]
    }
  ]
}

Generate exactly ${pageCount} pages in the "pages" array. Number them 1 through ${pageCount}.
Use the WORD_MASK concept (${wordMaskWord ?? "a strong word"}, ${wordMaskType}, ${wordMaskDirection}) on the most appropriate page.
Make every page title and direction feel specific to this magazine — not generic.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5-20251001", // Use Opus for creative quality
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic error:", err);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const rawText = data.content?.[0]?.text ?? "{}";
    const clean = rawText.replace(/```json|```/g, "").trim();

    let foundation;
    try {
      foundation = JSON.parse(clean);
    } catch {
      console.error("Parse failed:", rawText.slice(0, 300));
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: rawText.slice(0, 500) }), {
        status: 422, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ foundation }), {
      status: 200, headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});