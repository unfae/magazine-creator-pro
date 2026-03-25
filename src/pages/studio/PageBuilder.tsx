// src/pages/studio/PageBuilder.tsx
// Variadic Page JSON Generator — /studio/page-builder
// Generates layout_json with optional variance fields.
// Receives foundation data from /studio/foundation via router state.

import { useMemo, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Copy, Eye, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { generateVariadicPageLayout, type VariadicTextInput, type DesignElementInput } from '@/lib/variadicPageLayoutGenerator';
import { resolveVariance } from '@/lib/resolveVariance';
import type { DesignElementType } from '@/lib/variadicTypes';

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function RangeInput({ label, value, onChange }: {
  label: string;
  value: [number, number] | undefined;
  onChange: (v: [number, number] | undefined) => void;
}) {
  const enabled = value !== undefined;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={enabled}
          onChange={e => onChange(e.target.checked ? [0, 0] : undefined)}
          className="h-3 w-3 accent-gold" />
        <Label className="text-[11px] cursor-pointer">{label}</Label>
      </div>
      {enabled && (
        <div className="flex items-center gap-1.5 pl-5">
          <Input type="number" value={value![0]}
            onChange={e => onChange([Number(e.target.value), value![1]])}
            className="h-7 text-xs w-20" placeholder="min" />
          <span className="text-xs text-muted-foreground">→</span>
          <Input type="number" value={value![1]}
            onChange={e => onChange([value![0], Number(e.target.value)])}
            className="h-7 text-xs w-20" placeholder="max" />
        </div>
      )}
    </div>
  );
}

// ── Design element row ────────────────────────────────────────────────────────

const ELEMENT_TYPES: DesignElementType[] = ['line', 'rect', 'circle', 'dot', 'dot-grid'];

function DesignElementRow({ el, idx, onChange, onRemove }: {
  el: DesignElementInput; idx: number;
  onChange: (v: DesignElementInput) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const set = (k: keyof DesignElementInput, v: any) => onChange({ ...el, [k]: v });

  return (
    <div className="rounded-md border p-3 space-y-2 bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select value={el.type} onChange={e => set('type', e.target.value)}
            className="h-7 rounded border border-input bg-background px-2 text-xs">
            {ELEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">#{idx + 1} — {el.id}</span>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => setOpen(v => !v)}
            className="text-muted-foreground hover:text-foreground p-1">
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={onRemove} className="text-destructive hover:opacity-80 p-1">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {(['x','y','width','height'] as const).map(f => (
            <div key={f}>
              <Label className="text-[10px]">{f}</Label>
              <Input type="number" value={(el as any)[f] ?? 0}
                onChange={e => set(f as any, Number(e.target.value))}
                className="h-7 text-xs" />
            </div>
          ))}
          <div>
            <Label className="text-[10px]">color</Label>
            <Input value={el.color} onChange={e => set('color', e.target.value)}
              className="h-7 text-xs" placeholder="#000" />
          </div>
          <div>
            <Label className="text-[10px]">opacity</Label>
            <Input type="number" step="0.1" min={0} max={1} value={el.opacity ?? 1}
              onChange={e => set('opacity', Number(e.target.value))}
              className="h-7 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">rotate</Label>
            <Input type="number" value={el.rotate ?? 0}
              onChange={e => set('rotate', Number(e.target.value))}
              className="h-7 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">zIndex</Label>
            <Input type="number" value={el.zIndex ?? 5}
              onChange={e => set('zIndex', Number(e.target.value))}
              className="h-7 text-xs" />
          </div>
          <div className="col-span-2">
            <Label className="text-[10px]">elementGroup (e.g. 1C)</Label>
            <Input value={el.elementGroup ?? ''} onChange={e => set('elementGroup', e.target.value)}
              className="h-7 text-xs" placeholder="1C" />
          </div>
          <div>
            <Label className="text-[10px]">variantCount</Label>
            <Input type="number" min={1} value={el.elementVariantCount ?? 2}
              onChange={e => set('elementVariantCount', Number(e.target.value))}
              className="h-7 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">colorOptions (comma-sep)</Label>
            <Input value={(el.colorOptions ?? []).join(',')}
              onChange={e => set('colorOptions', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="h-7 text-xs" placeholder="#fff,#000" />
          </div>
          <div className="col-span-2 space-y-1">
            <RangeInput label="X variance" value={el.xVariance} onChange={v => set('xVariance', v)} />
            <RangeInput label="Y variance" value={el.yVariance} onChange={v => set('yVariance', v)} />
            <RangeInput label="Rotate variance" value={el.rotateVariance} onChange={v => set('rotateVariance', v)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Text block row ────────────────────────────────────────────────────────────

function TextRow({ ti, idx, onChange }: {
  ti: VariadicTextInput; idx: number;
  onChange: (v: VariadicTextInput) => void;
}) {
  const [open, setOpen] = useState(false);
  const set = (k: keyof VariadicTextInput, v: any) => onChange({ ...ti, [k]: v });

  return (
    <div className="rounded-md border p-3 space-y-2 bg-muted/20">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(v => !v)}
          className="text-muted-foreground hover:text-foreground">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <span className="text-xs font-medium">{idx + 1}. {ti.id}</span>
        <Input value={ti.defaultText}
          onChange={e => set('defaultText', e.target.value)}
          className="flex-1 h-7 text-xs" placeholder="Default text" />
      </div>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 pl-5">
          <div>
            <Label className="text-[10px]">ID</Label>
            <Input value={ti.id} onChange={e => set('id', e.target.value)} className="h-7 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">profileField</Label>
            <Input value={ti.profileField ?? ''} onChange={e => set('profileField', e.target.value)} className="h-7 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">aiHint</Label>
            <Input value={ti.aiHint ?? ''} onChange={e => set('aiHint', e.target.value)} className="h-7 text-xs" placeholder="short, max 6 words" />
          </div>
          <div>
            <Label className="text-[10px]">paletteRole</Label>
            <Input value={ti.paletteRole ?? ''} onChange={e => set('paletteRole', e.target.value)} className="h-7 text-xs" placeholder="text / accent" />
          </div>
          <div>
            <Label className="text-[10px]">fontFamilyOptions (comma-sep)</Label>
            <Input value={(ti.fontFamilyOptions ?? []).join(',')}
              onChange={e => set('fontFamilyOptions', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="h-7 text-xs" placeholder="Playfair Display, Cormorant" />
          </div>
          <div>
            <Label className="text-[10px]">colorOptions (comma-sep)</Label>
            <Input value={(ti.colorOptions ?? []).join(',')}
              onChange={e => set('colorOptions', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="h-7 text-xs" placeholder="#000,#fff,#C69339" />
          </div>
          <RangeInput label="X variance" value={ti.xVariance} onChange={v => set('xVariance', v)} />
          <RangeInput label="Y variance" value={ti.yVariance} onChange={v => set('yVariance', v)} />
          <RangeInput label="Width variance" value={ti.widthVariance} onChange={v => set('widthVariance', v)} />
          <RangeInput label="Height variance" value={ti.heightVariance} onChange={v => set('heightVariance', v)} />
          <RangeInput label="Rotate variance" value={ti.rotateVariance} onChange={v => set('rotateVariance', v)} />
          <RangeInput label="Text length range (words)" value={ti.textLengthRange as any} onChange={v => set('textLengthRange', v)} />
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PageBuilder() {
  const location    = useLocation();
  const foundation  = (location.state as any)?.foundation;
  const brief       = (location.state as any)?.brief;

  const [pageNumber, setPageNumber]   = useState(1);
  const [photoSlots, setPhotoSlots]   = useState(1);
  const [pngElements, setPngElements] = useState(1);
  const [baseUrl, setBaseUrl]         = useState('');
  const [fontFamily, setFontFamily]   = useState(brief?.typographyDisplay?.split(',')[0]?.trim() || 'Playfair Display');
  const [paletteGroup, setPaletteGroup] = useState('');
  const [defaultRotateVariance, setDefaultRotateVariance] = useState<[number,number] | undefined>(undefined);
  const [defaultXVariance, setDefaultXVariance]           = useState<[number,number] | undefined>(undefined);
  const [defaultYVariance, setDefaultYVariance]           = useState<[number,number] | undefined>(undefined);
  const [showResolved, setShowResolved] = useState(false);

  // Text inputs
  const [textInputs, setTextInputs] = useState<VariadicTextInput[]>([
    { id: 'title', defaultText: 'Magazine Title' },
  ]);

  // Design elements
  const [designElements, setDesignElements] = useState<DesignElementInput[]>([]);

  // ── Auto-populate from foundation if available ────────────────────────────
  const pageFoundation = foundation?.pages?.find((p: any) => p.pageNumber === pageNumber);

  // ── Generate layout ───────────────────────────────────────────────────────
  const layout = useMemo(() => {
    return generateVariadicPageLayout({
      pageNumber,
      photoSlots,
      pngElements,
      textCount: textInputs.length,
      baseUrl: baseUrl || 'https://example.com/template',
      fontFamily,
      paletteGroup: paletteGroup || undefined,
      textInputs,
      designElements: designElements.length ? designElements : undefined,
      defaultTextVariance: {
        x:      defaultXVariance ? { 0: defaultXVariance[0], 1: defaultXVariance[1] } as any : undefined,
        y:      defaultYVariance ? { 0: defaultYVariance[0], 1: defaultYVariance[1] } as any : undefined,
        rotate: defaultRotateVariance ? { 0: defaultRotateVariance[0], 1: defaultRotateVariance[1] } as any : undefined,
      },
    });
  }, [pageNumber, photoSlots, pngElements, baseUrl, fontFamily, paletteGroup,
      textInputs, designElements, defaultXVariance, defaultYVariance, defaultRotateVariance]);

  const resolvedLayout = useMemo(() => {
    if (!showResolved) return null;
    return resolveVariance(layout, {
      seedString: `preview__page${pageNumber}__${Date.now()}`,
      templateBaseUrl: baseUrl,
    });
  }, [showResolved, layout, pageNumber, baseUrl]);

  const jsonText       = useMemo(() => JSON.stringify(layout, null, 2), [layout]);
  const resolvedJson   = useMemo(() => resolvedLayout ? JSON.stringify(resolvedLayout, null, 2) : '', [resolvedLayout]);

  async function onCopy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success('Copied!'); }
    catch { toast.error('Copy failed'); }
  }

  function addText() {
    setTextInputs(prev => [...prev, { id: `text_${prev.length + 1}`, defaultText: '' }]);
  }
  function removeText(i: number) {
    setTextInputs(prev => prev.filter((_, idx) => idx !== i));
  }
  function addElement() {
    const n = designElements.length + 1;
    setDesignElements(prev => [...prev, {
      id: `el_${n}`, type: 'line', x: 0, y: 700, width: 1000, height: 2,
      color: '#000000', opacity: 1, rotate: 0, zIndex: 5,
    }]);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Studio</p>
        <h1 className="text-2xl font-semibold tracking-tight">Page Builder</h1>
        <p className="text-sm text-muted-foreground mt-1">Generate variadic layout JSON for each template page.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Controls ── */}
        <div className="space-y-4">

          {/* Foundation hint */}
          {pageFoundation && (
            <div className="rounded-lg border border-gold/30 bg-gold/5 p-4 space-y-1">
              <p className="text-xs font-semibold text-gold uppercase tracking-wide">
                Page {pageNumber}: {pageFoundation.title}
              </p>
              <p className="text-xs text-muted-foreground">{pageFoundation.direction}</p>
              <p className="text-xs text-muted-foreground italic">Visual: {pageFoundation.visualMetaphor}</p>
            </div>
          )}

          {/* Page config */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Page Config</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Page #', pageNumber, setPageNumber, 1],
                ['Photo slots', photoSlots, setPhotoSlots, 0],
                ['PNG elements', pngElements, setPngElements, 0],
              ].map(([label, val, setter, min]) => (
                <div key={label as string}>
                  <Label className="text-[10px]">{label as string}</Label>
                  <Input type="number" min={min as number} value={val as number}
                    onChange={e => (setter as any)(Math.max(min as number, Number(e.target.value)))}
                    className="h-8 text-sm" />
                </div>
              ))}
            </div>
            <div>
              <Label className="text-[10px]">Base URL</Label>
              <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
                className="h-8 text-xs" placeholder="https://.../storage/.../template_pages/template-name" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Default font family</Label>
                <Input value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Palette group</Label>
                <Input value={paletteGroup} onChange={e => setPaletteGroup(e.target.value)}
                  className="h-8 text-xs" placeholder="warm / cool / mono" />
              </div>
            </div>
          </div>

          {/* Default variance */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Default Block Variance</h2>
            <p className="text-[11px] text-muted-foreground">Applied to all blocks unless overridden per-block below.</p>
            <RangeInput label="X offset" value={defaultXVariance} onChange={setDefaultXVariance} />
            <RangeInput label="Y offset" value={defaultYVariance} onChange={setDefaultYVariance} />
            <RangeInput label="Rotation" value={defaultRotateVariance} onChange={setDefaultRotateVariance} />
          </div>

          {/* Text blocks */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Text Blocks ({textInputs.length})
              </h2>
              <button type="button" onClick={addText}
                className="flex items-center gap-1 text-xs text-gold hover:opacity-80">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            {textInputs.map((ti, i) => (
              <div key={i} className="relative">
                <TextRow ti={ti} idx={i} onChange={v => setTextInputs(prev => prev.map((t, idx) => idx === i ? v : t))} />
                {textInputs.length > 1 && (
                  <button type="button" onClick={() => removeText(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Design elements */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Design Elements ({designElements.length})
              </h2>
              <button type="button" onClick={addElement}
                className="flex items-center gap-1 text-xs text-gold hover:opacity-80">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            {designElements.map((el, i) => (
              <DesignElementRow key={i} el={el} idx={i}
                onChange={v => setDesignElements(prev => prev.map((e, idx) => idx === i ? v : e))}
                onRemove={() => setDesignElements(prev => prev.filter((_, idx) => idx !== i))}
              />
            ))}
            {designElements.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                No elements. Add lines, shapes, or dot grids.
              </p>
            )}
          </div>

        </div>

        {/* ── Output ── */}
        <div className="space-y-4">

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 flex-1"
              onClick={() => onCopy(jsonText)}>
              <Copy className="h-3.5 w-3.5" /> Copy Variadic JSON
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5"
              onClick={() => setShowResolved(v => !v)}>
              <Eye className="h-3.5 w-3.5" />
              {showResolved ? 'Hide' : 'Preview Resolved'}
            </Button>
          </div>

          {/* Variadic JSON */}
          <div className="rounded-lg border bg-card p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Variadic Layout JSON</p>
              <p className="text-[10px] text-muted-foreground">Save to template_pages.layout_json</p>
            </div>
            <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
              {jsonText}
            </pre>
          </div>

          {/* Resolved preview */}
          {showResolved && resolvedJson && (
            <div className="rounded-lg border bg-card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">Resolved Preview (random seed)</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => onCopy(resolvedJson)} className="h-6 text-xs gap-1">
                  <Copy className="h-3 w-3" /> Copy
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                This is one possible variant. Click "Preview Resolved" again to regenerate with a different seed.
              </p>
              <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
                {resolvedJson}
              </pre>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}