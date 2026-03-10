import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { generatePageLayout } from "@/lib/pageLayoutGenerator";

export default function PageJsonGenerator() {
  const [pageNumber, setPageNumber] = useState(1);
  const [photoSlots, setPhotoSlots] = useState(1);
  const [pngElements, setPngElements] = useState(1);
  const [textCount, setTextCount] = useState(1);

  const [baseUrl, setBaseUrl] = useState(
    "https://<ref>.supabase.co/storage/v1/object/public/template_pages/elegance"
  );
  const [fontFamily, setFontFamily] = useState("PlayfairDisplay SC");
  const [textsRaw, setTextsRaw] = useState("title:Magazine Title");

  const layout = useMemo(() => {
    // Parse textsRaw lines into { id, defaultText } objects
    const parsed = textsRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line, idx) => {
        const [id, ...rest] = line.split(":");
        return {
          id: (id || `text_${idx + 1}`).trim(),
          defaultText: (rest.join(":") || `Text ${idx + 1}`).trim(),
        };
      });

    // Pad if textCount > lines provided
    const texts = [...parsed];
    while (texts.length < textCount) {
      const i = texts.length + 1;
      texts.push({ id: `text_${i}`, defaultText: `Text ${i}` });
    }

    return generatePageLayout({
      pageNumber,
      photoSlots,
      pngElements,
      textCount,
      baseUrl,
      texts,
      fontFamily,
    });
  }, [pageNumber, photoSlots, pngElements, textCount, baseUrl, textsRaw, fontFamily]);

  const jsonText = useMemo(() => JSON.stringify(layout, null, 2), [layout]);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(jsonText);
      toast.success("JSON copied successfully");
    } catch {
      toast.error("Copy failed — please copy manually from the output box.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Page JSON Generator</h1>
        <p className="text-sm text-muted-foreground">
          Generate a layout JSON quickly, then tweak positions and font sizes as needed.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Controls ──────────────────────────────────────────────────────── */}
        <div className="rounded-lg border bg-card p-4 space-y-4">

          {/* Page number */}
          <div className="space-y-1.5">
            <Label htmlFor="pageNumber">Page number</Label>
            <Input
              id="pageNumber"
              type="number"
              min={1}
              value={pageNumber}
              onChange={(e) => setPageNumber(Math.max(1, Number(e.target.value)))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Sets file name prefix (page 2 → 2A, 2B…) and adds the pagination
              element for pages 2+.
            </p>
          </div>

          {/* Element counts — 1 col on mobile, 3 col on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="photoSlots">Photo slots</Label>
              <Input
                id="photoSlots"
                type="number"
                min={0}
                value={photoSlots}
                onChange={(e) => setPhotoSlots(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pngElements">PNG elements</Label>
              <Input
                id="pngElements"
                type="number"
                min={0}
                value={pngElements}
                onChange={(e) => setPngElements(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="textCount">Text blocks</Label>
              <Input
                id="textCount"
                type="number"
                min={0}
                value={textCount}
                onChange={(e) => setTextCount(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Single base URL */}
          <div className="space-y-1.5">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Used for both photo slots and PNG overlays.
            </p>
          </div>

          {/* Font family */}
          <div className="space-y-1.5">
            <Label htmlFor="fontFamily">Font family</Label>
            <Input
              id="fontFamily"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Texts */}
          <div className="space-y-1.5">
            <Label htmlFor="textsRaw">Texts (one per line: id:default text)</Label>
            <Textarea
              id="textsRaw"
              value={textsRaw}
              onChange={(e) => setTextsRaw(e.target.value)}
              className="min-h-28 w-full"
            />
          </div>

          <Button type="button" variant="outline" onClick={onCopy} className="gap-2 w-full sm:w-auto">
            <Copy className="h-4 w-4" />
            Copy JSON
          </Button>
        </div>

        {/* ── Output ────────────────────────────────────────────────────────── */}
        <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Output</p>
            <p className="text-xs text-muted-foreground">
              Copy and paste into your template page record.
            </p>
          </div>

          <pre className="flex-1 max-h-[560px] overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
            {jsonText}
          </pre>
        </div>

      </div>
    </div>
  );
}