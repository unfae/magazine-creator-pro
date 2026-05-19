// supabase/functions/generate-template/index.ts
// Generates creative, print-worthy magazine template layouts via Claude.
// All pages generated in a single API call to minimise token usage.

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

const SYSTEM_PROMPT = `You are a world-class magazine art director and print designer with 20+ years of experience creating award-winning editorial layouts. You produce creative, print-worthy magazine template layouts as structured JSON.

## Canvas
- Page size: 1000 × 1415 px (portrait, roughly A4)
- Safe text margin: 40 px from each edge
- Full-bleed backgrounds/images may extend to 0 px edges

## Schema

TextBlock:
{ id, x, y, width, height, defaultText?, fontSize?, fontFamily?, fontWeight?, lineHeight?, letterSpacing?, color?, align?, zIndex?, rotate?, editable? }

ImageBlock:
{ id, x, y, width, height, zIndex?, borderRadius?, rotate?, defaultImageUrl?, border?: { width, color, style }, editable? }

## Design principles (FOLLOW THESE)
- Strong visual hierarchy: one dominant element per page (hero image or headline)
- Font scale: display 80–140px · headline 48–72px · subhead 24–40px · body 13–17px · caption 10–12px
- Vary weights: pair a bold display font with a lighter body font
- Tension and movement: slightly rotated text (−4° to +4°) or overlapping elements add energy
- White space is design: don't fill every pixel; breathing room elevates quality
- Color: use the palette consistently; max 3–4 colors per page
- Image blocks: hero images should dominate (>40% of page area on feature pages)
- zIndex layering: backgrounds 1–2, images 3–6, overlapping text 7–12, top text 13–20
- Mark decorative/fixed elements editable:false; user-fillable slots editable:true

## Output format
Respond with ONLY valid JSON — no markdown fences, no explanation:
{
  "pages": [
    {
      "page_number": 1,
      "layout_json": {
        "textBlocks": [...],
        "imageBlocks": [...]
      }
    }
  ]
}`;

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
      title,
      description,
      targetAudience,
      useCase,
      style,
      mandatoryTextFields = [],
      optionalTextHints = "",
      pageCount = 4,
      refinementFeedback = "",
      previousPages = null,
      inspirationImages = [], // array of base64 strings
    } = body;

    if (!title) {
      return new Response(JSON.stringify({ error: "title is required" }), {
        status: 400, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const clampedPageCount = Math.min(Math.max(Number(pageCount) || 4, 1), 20);

    // Build user message content
    const userText = refinementFeedback && previousPages
      ? `Refine this magazine template based on feedback.

CURRENT TEMPLATE (${clampedPageCount} pages):
${JSON.stringify(previousPages, null, 0)}

REFINEMENT FEEDBACK:
${refinementFeedback}

Apply the feedback while preserving what works. Return the full updated JSON for all ${clampedPageCount} pages.`
      : `Generate a ${clampedPageCount}-page magazine template with these specs:

TITLE: ${title}
DESCRIPTION: ${description || "—"}
TARGET AUDIENCE: ${targetAudience || "general"}
USE CASE: ${useCase || "general magazine"}
STYLE: ${style || "modern, clean"}
MANDATORY TEXT FIELDS (must include, editable:true): ${mandatoryTextFields.length ? mandatoryTextFields.join(", ") : "none specified"}
OPTIONAL TEXT HINTS (add if they enhance the design): ${optionalTextHints || "none"}

LAYOUT REQUIREMENTS:
- Page 1: striking cover — hero image, title, edition/date, tagline
- Last page: back cover or closing spread
- Middle pages: varied editorial layouts (feature, profile, full-bleed image, text-heavy, etc.)
- No two pages should have the same layout
- Every page must feel intentional and print-ready
- Be bold and creative — this is a premium product`;

    const contentBlocks: any[] = [{ type: "text", text: userText }];

    // Attach inspiration images if provided (max 3 to save tokens)
    const images = (inspirationImages as string[]).slice(0, 3);
    for (const b64 of images) {
      if (!b64) continue;
      const isUrl = b64.startsWith("http");
      if (isUrl) {
        contentBlocks.push({ type: "image", source: { type: "url", url: b64 } });
      } else {
        const comma = b64.indexOf(",");
        const data = comma >= 0 ? b64.slice(comma + 1) : b64;
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data },
        });
      }
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 16000,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" }, // cache system prompt across calls
          },
        ],
        messages: [{ role: "user", content: contentBlocks }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return new Response(JSON.stringify({ error: "AI generation failed", detail: err }), {
        status: 502, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const aiRes = await response.json();
    const rawText = aiRes.content?.[0]?.text ?? "";

    // Strip any accidental markdown fences
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: rawText.slice(0, 500) }), {
        status: 502, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const pages: any[] = parsed.pages ?? [];

    // Generate SQL for easy Supabase insertion
    const templateId = crypto.randomUUID();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const sqlLines: string[] = [
      `-- Run this SQL in your Supabase SQL editor`,
      ``,
      `INSERT INTO templates (id, name, slug, description, price, required_photos, page_count, is_active)`,
      `VALUES (`,
      `  '${templateId}',`,
      `  ${JSON.stringify(title)},`,
      `  '${slug}',`,
      `  ${JSON.stringify(description || title)},`,
      `  0,`,
      `  ${pages.reduce((acc: number, p: any) => acc + (p.layout_json?.imageBlocks?.filter((b: any) => b.editable !== false).length ?? 0), 0)},`,
      `  ${pages.length},`,
      `  true`,
      `);`,
      ``,
      `INSERT INTO template_pages (id, template_id, page_number, layout_json) VALUES`,
      ...pages.map((p: any, i: number) =>
        `  ('${crypto.randomUUID()}', '${templateId}', ${p.page_number ?? i + 1}, '${JSON.stringify(p.layout_json).replace(/'/g, "''")}')${i < pages.length - 1 ? "," : ";"}`
      ),
    ];

    return new Response(
      JSON.stringify({
        pages,
        templateId,
        slug,
        sql: sqlLines.join("\n"),
        usage: aiRes.usage,
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-template error:", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Unknown error" }), {
      status: 500, headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});