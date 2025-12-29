import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { generatePageLayout } from "@/lib/pageLayoutGenerator";

export default function PageJsonGenerator() {
  const [photoSlots, setPhotoSlots] = useState(1);
  const [pngElements, setPngElements] = useState(1);
  const [textCount, setTextCount] = useState(1);

  const [photosBaseUrl, setPhotosBaseUrl] = useState(
    "https://<ref>.supabase.co/storage/v1/object/public/template_pages/elegance"
  );
  const [pngBaseUrl, setPngBaseUrl] = useState(
    "https://<ref>.supabase.co/storage/v1/object/public/template_pages/elegance"
  );

  const [fontFamily, setFontFamily] = useState("PlayfairDisplay SC");
  const [textsRaw, setTextsRaw] = useState("title:Magazine Title");

  const layout = useMemo(() => {
    const texts = textsRaw
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

    return generatePageLayout({
      photoSlots,
      pngElements,
      textCount,
      photosBaseUrl,
      pngBaseUrl,
      texts,
      fontFamily,
    });
  }, [photoSlots, pngElements, textCount, photosBaseUrl, pngBaseUrl, textsRaw, fontFamily]);

  const jsonText = useMemo(() => JSON.stringify(layout, null, 2), [layout]);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(jsonText);
      toast.success("JSON format copied successfully");
    } catch {
      toast.error("Copy failed. Please copy manually from the output box.");
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Controls */}
        <div className="rounded-lg border bg-card p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="photoSlots">Photo slots</Label>
                <Input
                  id="photoSlots"
                  type="number"
                  min={0}
                  value={photoSlots}
                  onChange={(e) => setPhotoSlots(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pngElements">PNG elements</Label>
                <Input
                  id="pngElements"
                  type="number"
                  min={0}
                  value={pngElements}
                  onChange={(e) => setPngElements(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="textCount">Text blocks</Label>
                <Input
                  id="textCount"
                  type="number"
                  min={0}
                  value={textCount}
                  onChange={(e) => setTextCount(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="photosBaseUrl">Photos base URL</Label>
              <Input
                id="photosBaseUrl"
                value={photosBaseUrl}
                onChange={(e) => setPhotosBaseUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pngBaseUrl">PNGs base URL</Label>
              <Input id="pngBaseUrl" value={pngBaseUrl} onChange={(e) => setPngBaseUrl(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fontFamily">Font family</Label>
              <Input id="fontFamily" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="textsRaw">Texts (one per line: id:text)</Label>
              <Textarea
                id="textsRaw"
                value={textsRaw}
                onChange={(e) => setTextsRaw(e.target.value)}
                className="min-h-28"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onCopy} className="gap-2">
                <Copy className="h-4 w-4" />
                Copy JSON
              </Button>

              <div className="text-xs text-muted-foreground">
                Page name: <span className="font-mono">{layout.pageName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Output</div>
              <div className="text-xs text-muted-foreground">Copy and paste into your template page record.</div>
            </div>
          </div>

          <pre className="max-h-[520px] overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
            {jsonText}
          </pre>
        </div>
      </div>
    </div>
  );
}
