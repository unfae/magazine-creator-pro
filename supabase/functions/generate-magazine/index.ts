// supabase/functions/generate-magazine/index.ts
// Single Claude call — returns ALL page concepts + ALL AI text at once.
// Target: complete in under 15 seconds for up to 12 pages.

import { serve } from "https://deno.land/std/http/server.ts";

const ALLOWED_ORIGINS = [
  "https://magznmaker.com", "https://www.magznmaker.com",
  "http://localhost:5173", "http://localhost:3000",
];

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers });

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), {
      status: 503, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      description, pageCount = 8, gender = "female",
      magazineTitle, vibes = [], colorHint, fontHint,
    } = body;

    if (!description) {
      return new Response(JSON.stringify({ error: "description is required" }), {
        status: 400, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const system = `You are a world-class magazine art director. 
You create vivid, specific, emotionally resonant magazine concepts.
Respond ONLY with valid JSON — no markdown, no preamble, no explanation.`;

    const user = `Create a complete magazine concept from this brief:

DESCRIPTION: ${description}
PAGES: ${pageCount}
GENDER: ${gender}
TITLE HINT: ${magazineTitle || "choose the best title for this magazine"}
VIBE: ${vibes.length ? vibes.join(", ") : "match the description's mood"}
COLOUR HINT: ${colorHint || "derive from the mood"}
FONT HINT: ${fontHint || "derive from the vibe"}

Return ONLY this JSON structure — every field is required:

{
  "magazineTitle": "The chosen title",
  "tagline": "A short evocative subtitle, max 8 words",
  "overallMood": "2-4 words",
  "colorDirection": "Describe the palette — warm/cool, specific hues, reasoning",
  "paletteHint": {
    "background": "#hex",
    "primary": "#hex",
    "accent": "#hex",
    "text": "#hex"
  },
  "fontDirection": "Which typography category suits this — classic serif, bold condensed, clean sans etc",
  "pages": [
    {
      "pageNumber": 1,
      "title": "Page title — 2 to 5 words, evocative",
      "layoutType": "cover|full_bleed|split_left|split_right|portrait_center|text_heavy|minimal|collage|word_mask|editorial",
      "imageCount": 1,
      "hasVisualMetaphor": true,
      "visualMetaphor": "A concrete visual image — one strong specific thing",
      "metaphorKeywords": ["keyword1", "keyword2", "keyword3"],
      "textFields": {
        "headline": "The main headline text for this page",
        "subheading": "Secondary line if needed, or empty string",
        "body": "Body copy — 1 to 3 sentences matching the page mood and vibe",
        "caption": "Short caption or label if applicable, or empty string"
      },
      "imageDescription": "What kind of photo goes here — e.g. full-body portrait outdoors, close-up hands, candid laugh"
    }
  ]
}

RULES:
- Generate exactly ${pageCount} pages numbered 1 to ${pageCount}
- Page 1 is always layout "cover"
- hasVisualMetaphor should be true for ${Math.round(pageCount * 0.55)} pages — pick the most evocative ones
- When hasVisualMetaphor is false, set visualMetaphor and metaphorKeywords to null
- layoutType must be one of the exact strings listed above
- Make every page title, body text, and visual metaphor SPECIFIC to this magazine — never generic
- The gender (${gender}) should inform photo descriptions and text tone
- All textFields must be non-null strings (use "" if not applicable)
- metaphorKeywords should be 2-4 short words suitable for icon library search`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic error:", err);
      return new Response(JSON.stringify({ error: "AI generation failed", detail: err }), {
        status: 500, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const raw  = data.content?.[0]?.text ?? "{}";
    const clean = raw.replace(/```json|```/g, "").trim();

    let magazine;
    try {
      magazine = JSON.parse(clean);
    } catch {
      console.error("Parse failed:", raw.slice(0, 400));
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: raw.slice(0, 500) }), {
        status: 422, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ magazine }), {
      status: 200, headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Function error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});