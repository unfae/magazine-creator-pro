// src/pages/studio/PageBuilder.tsx — dark theme, full variance for image blocks,
// tag-based font family per text, custom IDs, SVG elements, palette colour groups

import { useMemo, useState, useRef, KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Copy, Eye, Plus, Trash2, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { toast } from 'sonner';
import { generateVariadicPageLayout, type VariadicTextInput, type DesignElementInput } from '@/lib/variadicPageLayoutGenerator';
import { resolveVariance } from '@/lib/resolveVariance';
import type { DesignElementType } from '@/lib/variadicTypes';

// ── Dark theme constants ──────────────────────────────────────────────────────
const D = {
  page:  'min-h-screen bg-background text-foreground',
  card:  'rounded-xl border border-border bg-card p-4 space-y-3',
  label: 'block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1',
  input: 'w-full rounded-md border border-input bg-muted px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold transition-colors',
  sect:  'text-[10px] font-bold text-gold uppercase tracking-widest',
  chip:  'flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[11px] text-foreground',
};

// ── Tag input (shared) ────────────────────────────────────────────────────────
function TagInput({ tags, onChange, placeholder, isColor }: {
  tags: string[]; onChange: (t: string[]) => void;
  placeholder?: string; isColor?: boolean;
}) {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  function commit() {
    const v = val.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setVal('');
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
    if (e.key === 'Backspace' && !val && tags.length) onChange(tags.slice(0, -1));
  }

  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-input bg-muted p-1.5 min-h-[34px] cursor-text focus-within:border-gold transition-colors"
      onClick={() => ref.current?.focus()}>
      {tags.map(t => (
        <span key={t} className={D.chip}>
          {isColor && <span className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0" style={{ background: t }} />}
          {t}
          <button type="button" onClick={() => onChange(tags.filter(x => x !== t))}
            className="text-muted-foreground/80 hover:text-foreground ml-0.5">×</button>
        </span>
      ))}
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={onKey} onBlur={() => val.trim() && commit()}
        placeholder={tags.length ? '' : (placeholder ?? 'Enter + press Enter')}
        className="flex-1 min-w-[80px] bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none" />
    </div>
  );
}

// ── Range input ───────────────────────────────────────────────────────────────
function RangeInput({ label, value, onChange }: {
  label: string; value: [number, number] | undefined;
  onChange: (v: [number, number] | undefined) => void;
}) {
  const on = value !== undefined;
  return (
    <div className="space-y-0.5">
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input type="checkbox" checked={on}
          onChange={e => onChange(e.target.checked ? [0, 0] : undefined)}
          className="accent-gold h-3 w-3" />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </label>
      {on && (
        <div className="flex items-center gap-1.5 pl-4">
          <input type="number" value={value![0]}
            onChange={e => onChange([Number(e.target.value), value![1]])}
            className={D.input + ' w-16'} placeholder="min" />
          <span className="text-muted-foreground/60 text-xs">→</span>
          <input type="number" value={value![1]}
            onChange={e => onChange([value![0], Number(e.target.value)])}
            className={D.input + ' w-16'} placeholder="max" />
        </div>
      )}
    </div>
  );
}

// ── Text block row ────────────────────────────────────────────────────────────
function TextRow({ ti, idx, onChange }: {
  ti: VariadicTextInput; idx: number; onChange: (v: VariadicTextInput) => void;
}) {
  const [open, setOpen] = useState(false);
  const s = (k: keyof VariadicTextInput, v: any) => onChange({ ...ti, [k]: v });

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(v => !v)} className="text-muted-foreground/60 hover:text-foreground">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {/* Editable ID inline */}
        <input value={ti.id} onChange={e => s('id', e.target.value)}
          className="w-28 rounded border border-input bg-muted px-2 py-0.5 text-[11px] text-gold font-mono focus:outline-none focus:border-gold"
          placeholder="field_id" />
        <input value={ti.defaultText} onChange={e => s('defaultText', e.target.value)}
          className={D.input + ' flex-1'} placeholder="Default text" />
      </div>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-5 pt-2">
          <div>
            <label className={D.label}>Font family options</label>
            <TagInput tags={ti.fontFamilyOptions ?? []}
              onChange={v => s('fontFamilyOptions', v)}
              placeholder="Playfair Display" />
          </div>
          <div>
            <label className={D.label}>Colour options</label>
            <TagInput tags={ti.colorOptions ?? []}
              onChange={v => s('colorOptions', v)}
              placeholder="#fff" isColor />
          </div>
          <div>
            <label className={D.label}>Profile field</label>
            <input value={ti.profileField ?? ''} onChange={e => s('profileField', e.target.value)}
              className={D.input} placeholder="full_name" />
          </div>
          <div>
            <label className={D.label}>AI hint</label>
            <input value={ti.aiHint ?? ''} onChange={e => s('aiHint', e.target.value)}
              className={D.input} placeholder="short, 6 words max" />
          </div>
          <div>
            <label className={D.label}>Palette role</label>
            <input value={ti.paletteRole ?? ''} onChange={e => s('paletteRole', e.target.value)}
              className={D.input} placeholder="text / accent" />
          </div>
          <div className="space-y-1.5">
            <RangeInput label="X variance"      value={ti.xVariance}      onChange={v => s('xVariance', v)} />
            <RangeInput label="Y variance"      value={ti.yVariance}      onChange={v => s('yVariance', v)} />
            <RangeInput label="Width variance"  value={ti.widthVariance}  onChange={v => s('widthVariance', v)} />
            <RangeInput label="Height variance" value={ti.heightVariance} onChange={v => s('heightVariance', v)} />
            <RangeInput label="Rotate variance" value={ti.rotateVariance} onChange={v => s('rotateVariance', v)} />
            <RangeInput label="Length (words)"  value={ti.textLengthRange as any} onChange={v => s('textLengthRange', v)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Image block row (per photo/svg slot) ──────────────────────────────────────
interface ImgSlotState {
  maskGroup?: string;
  maskVariantCount?: number;
  paletteRole?: string;
  xVariance?: [number, number];
  yVariance?: [number, number];
  widthVariance?: [number, number];
  heightVariance?: [number, number];
  rotateVariance?: [number, number];
}

function ImageSlotRow({ slot, idx, label, onChange }: {
  slot: ImgSlotState; idx: number; label: string;
  onChange: (v: ImgSlotState) => void;
}) {
  const [open, setOpen] = useState(false);
  const s = (k: keyof ImgSlotState, v: any) => onChange({ ...slot, [k]: v });

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(v => !v)} className="text-muted-foreground/60 hover:text-foreground">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <span className="text-[11px] text-muted-foreground">{label} {idx + 1}</span>
        <span className="text-[10px] text-muted-foreground/60 ml-auto">{
          [slot.maskGroup, slot.xVariance && 'x±', slot.yVariance && 'y±', slot.rotateVariance && 'rot±']
            .filter(Boolean).join(' · ')
        }</span>
      </div>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-5 pt-1">
          <div>
            <label className={D.label}>Mask group (e.g. 1A)</label>
            <input value={slot.maskGroup ?? ''} onChange={e => s('maskGroup', e.target.value || undefined)}
              className={D.input} placeholder="1A" />
          </div>
          <div>
            <label className={D.label}>Mask variant count</label>
            <input type="number" min={1} value={slot.maskVariantCount ?? 2}
              onChange={e => s('maskVariantCount', Number(e.target.value))}
              className={D.input} />
          </div>
          <div>
            <label className={D.label}>Palette role</label>
            <input value={slot.paletteRole ?? ''} onChange={e => s('paletteRole', e.target.value || undefined)}
              className={D.input} placeholder="primary / accent" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <RangeInput label="X variance"      value={slot.xVariance}      onChange={v => s('xVariance', v)} />
            <RangeInput label="Y variance"      value={slot.yVariance}      onChange={v => s('yVariance', v)} />
            <RangeInput label="Width variance"  value={slot.widthVariance}  onChange={v => s('widthVariance', v)} />
            <RangeInput label="Height variance" value={slot.heightVariance} onChange={v => s('heightVariance', v)} />
            <RangeInput label="Rotate variance" value={slot.rotateVariance} onChange={v => s('rotateVariance', v)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Design element row ────────────────────────────────────────────────────────
const ELEM_TYPES: DesignElementType[] = ['line', 'rect', 'circle', 'dot', 'dot-grid'];

function DesignElemRow({ el, idx, onChange, onRemove }: {
  el: DesignElementInput; idx: number;
  onChange: (v: DesignElementInput) => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const s = (k: keyof DesignElementInput, v: any) => onChange({ ...el, [k]: v });

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(v => !v)} className="text-muted-foreground/60 hover:text-foreground">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <select value={el.type} onChange={e => s('type', e.target.value)}
          className="rounded border border-input bg-muted px-2 py-1 text-[11px] text-foreground focus:outline-none">
          {ELEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-[11px] text-muted-foreground/60 font-mono">{el.id}</span>
        <button type="button" onClick={onRemove} className="ml-auto text-destructive/60 hover:text-red-400">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-5 pt-1">
          {['x','y','width','height'].map(f => (
            <div key={f}>
              <label className={D.label}>{f}</label>
              <input type="number" value={(el as any)[f] ?? 0}
                onChange={e => s(f as any, Number(e.target.value))}
                className={D.input} />
            </div>
          ))}
          <div>
            <label className={D.label}>color</label>
            <input value={el.color} onChange={e => s('color', e.target.value)}
              className={D.input} placeholder="#C69339" />
          </div>
          <div>
            <label className={D.label}>opacity</label>
            <input type="number" step="0.05" min={0} max={1} value={el.opacity ?? 1}
              onChange={e => s('opacity', Number(e.target.value))} className={D.input} />
          </div>
          <div>
            <label className={D.label}>rotate</label>
            <input type="number" value={el.rotate ?? 0}
              onChange={e => s('rotate', Number(e.target.value))} className={D.input} />
          </div>
          <div>
            <label className={D.label}>zIndex</label>
            <input type="number" value={el.zIndex ?? 5}
              onChange={e => s('zIndex', Number(e.target.value))} className={D.input} />
          </div>
          <div className="col-span-2">
            <label className={D.label}>SVG element group (e.g. 1C)</label>
            <input value={el.elementGroup ?? ''} onChange={e => s('elementGroup', e.target.value)}
              className={D.input} placeholder="1C" />
          </div>
          <div>
            <label className={D.label}>Variant count</label>
            <input type="number" min={1} value={el.elementVariantCount ?? 2}
              onChange={e => s('elementVariantCount', Number(e.target.value))} className={D.input} />
          </div>
          <div>
            <label className={D.label}>Color options</label>
            <TagInput tags={el.colorOptions ?? []}
              onChange={v => s('colorOptions', v.length ? v : undefined)}
              placeholder="#fff" isColor />
          </div>
          <div className="col-span-2 sm:col-span-4 space-y-1.5">
            <RangeInput label="X variance"       value={el.xVariance}       onChange={v => s('xVariance', v)} />
            <RangeInput label="Y variance"       value={el.yVariance}       onChange={v => s('yVariance', v)} />
            <RangeInput label="Rotate variance"  value={el.rotateVariance}  onChange={v => s('rotateVariance', v)} />
            <RangeInput label="Opacity variance" value={el.opacityVariance} onChange={v => s('opacityVariance', v)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Palette colour groups ─────────────────────────────────────────────────────
// Each group is an array of hex codes. Users can add/remove groups.
interface ColourGroup { id: string; colors: string[] }

function ColourGroupEditor({ groups, onChange }: {
  groups: ColourGroup[];
  onChange: (g: ColourGroup[]) => void;
}) {
  function addGroup() {
    onChange([...groups, { id: `group_${groups.length + 1}`, colors: [] }]);
  }
  function removeGroup(i: number) { onChange(groups.filter((_, idx) => idx !== i)); }
  function updateColors(i: number, colors: string[]) {
    onChange(groups.map((g, idx) => idx === i ? { ...g, colors } : g));
  }
  function updateId(i: number, id: string) {
    onChange(groups.map((g, idx) => idx === i ? { ...g, id } : g));
  }

  return (
    <div className="space-y-3">
      {groups.map((g, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input value={g.id} onChange={e => updateId(i, e.target.value)}
              className="w-28 rounded border border-input bg-muted px-2 py-0.5 text-[11px] text-gold font-mono focus:outline-none focus:border-gold"
              placeholder="group_1" />
            <span className="text-[11px] text-muted-foreground/60">{g.colors.length} colour{g.colors.length !== 1 ? 's' : ''}</span>
            <div className="flex gap-0.5 ml-1">
              {g.colors.map(c => (
                <span key={c} className="w-3 h-3 rounded-sm border border-white/10" style={{ background: c }} />
              ))}
            </div>
            <button type="button" onClick={() => removeGroup(i)} className="ml-auto text-destructive/60 hover:text-red-400">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <TagInput tags={g.colors} onChange={v => updateColors(i, v)}
            placeholder="#C69339  →  press Enter" isColor />
        </div>
      ))}
      <button type="button" onClick={addGroup}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-input py-2 text-xs text-muted-foreground/60 hover:text-gold hover:border-gold transition-colors">
        <Plus className="h-3.5 w-3.5" /> Add colour group
      </button>
    </div>
  );
}

// ── JSON output ───────────────────────────────────────────────────────────────
function JsonOutput({ text, label }: { text: string; label: string }) {
  async function copy() {
    try { await navigator.clipboard.writeText(text); toast.success('Copied!'); }
    catch { toast.error('Copy failed'); }
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-gold uppercase tracking-widest">{label}</p>
        <button type="button" onClick={copy}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <Copy className="h-3 w-3" /> Copy
        </button>
      </div>
      <pre className="max-h-[480px] overflow-auto rounded-lg bg-background p-3 text-[11px] leading-relaxed text-foreground/90 font-mono whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PageBuilder() {
  const location   = useLocation();
  const foundation = (location.state as any)?.foundation;
  const brief      = (location.state as any)?.brief;

  const [pageNumber, setPageNumber]   = useState(1);
  const [photoSlots, setPhotoSlots]   = useState(1);
  const [svgElements, setSvgElements] = useState(1);
  const [baseUrl, setBaseUrl]         = useState('');
  const [fontFamily, setFontFamily]   = useState(
    brief?.typographyDisplay?.split(',')[0]?.trim() || 'Playfair Display'
  );
  const [showResolved, setShowResolved] = useState(false);

  // Default variance
  const [defX, setDefX]   = useState<[number,number] | undefined>(undefined);
  const [defY, setDefY]   = useState<[number,number] | undefined>(undefined);
  const [defR, setDefR]   = useState<[number,number] | undefined>(undefined);

  // Text blocks
  const [textInputs, setTextInputs] = useState<VariadicTextInput[]>([
    { id: 'title', defaultText: 'Magazine Title' },
  ]);

  // Image slot inputs (photo slots + SVG slots)
  const totalSlots = photoSlots + svgElements;
  const [imageSlots, setImageSlots] = useState<ImgSlotState[]>([]);
  // keep imageSlots array in sync with totalSlots
  const syncedSlots = useMemo(() => {
    const arr = [...imageSlots];
    while (arr.length < totalSlots) arr.push({});
    return arr.slice(0, totalSlots);
  }, [totalSlots, imageSlots]);

  // Design elements
  const [designElements, setDesignElements] = useState<DesignElementInput[]>([]);

  // Palette colour groups
  const [colourGroups, setColourGroups] = useState<ColourGroup[]>([]);

  const pageFoundation = foundation?.pages?.find((p: any) => p.pageNumber === pageNumber);

  // ── Build layout ────────────────────────────────────────────────────────────
  const layout = useMemo(() => {
    const paletteGroupValue = colourGroups.length
      ? JSON.stringify(Object.fromEntries(colourGroups.map(g => [g.id, g.colors])))
      : undefined;

    return generateVariadicPageLayout({
      pageNumber,
      photoSlots,
      pngElements:  svgElements,          // still called pngElements in the generator
      textCount:    textInputs.length,
      baseUrl:      baseUrl || 'https://example.com',
      fontFamily,
      paletteGroup: paletteGroupValue,
      textInputs,
      imageInputs:  syncedSlots.map(s => ({
        maskGroup:        s.maskGroup,
        maskVariantCount: s.maskVariantCount,
        paletteRole:      s.paletteRole,
        xVariance:        s.xVariance,
        yVariance:        s.yVariance,
        widthVariance:    s.widthVariance,
        heightVariance:   s.heightVariance,
        rotateVariance:   s.rotateVariance,
      })),
      designElements: designElements.length ? designElements : undefined,
      defaultTextVariance: {
        x:      defX ? { 0: defX[0], 1: defX[1] } as any : undefined,
        y:      defY ? { 0: defY[0], 1: defY[1] } as any : undefined,
        rotate: defR ? { 0: defR[0], 1: defR[1] } as any : undefined,
      },
    });
  }, [pageNumber, photoSlots, svgElements, baseUrl, fontFamily, textInputs,
      syncedSlots, designElements, colourGroups, defX, defY, defR]);

  const resolvedLayout = useMemo(() => {
    if (!showResolved) return null;
    return resolveVariance(layout as any, {
      seedString: `preview__page${pageNumber}__${Date.now()}`,
      templateBaseUrl: baseUrl,
    });
  }, [showResolved, layout, pageNumber, baseUrl]);

  const jsonText     = useMemo(() => JSON.stringify(layout, null, 2), [layout]);
  const resolvedJson = useMemo(() => resolvedLayout ? JSON.stringify(resolvedLayout, null, 2) : '', [resolvedLayout]);

  function addText() {
    setTextInputs(prev => [...prev, { id: `text_${prev.length + 1}`, defaultText: '' }]);
  }
  function addElement() {
    const n = designElements.length + 1;
    setDesignElements(prev => [...prev, {
      id: `el_${n}`, type: 'line', x: 0, y: 700, width: 1000, height: 2,
      color: hsl(var(--gold)), opacity: 1, rotate: 0, zIndex: 5,
    }]);
  }

  const numInput = (label: string, val: number, set: (n: number) => void, min = 0) => (
    <div>
      <label className={D.label}>{label}</label>
      <input type="number" min={min} value={val}
        onChange={e => set(Math.max(min, Number(e.target.value)))}
        className={D.input} />
    </div>
  );

  return (
    <div className={D.page}>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6">
          <p className="text-[10px] text-gold uppercase tracking-widest mb-1">Studio</p>
          <h1 className="text-2xl font-semibold">Page Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate variadic layout JSON with variance fields for AI templates.</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">

          {/* ── Left: controls ── */}
          <div className="space-y-4">

            {/* Foundation context */}
            {pageFoundation && (
              <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 space-y-1">
                <p className="text-[10px] font-bold text-gold uppercase tracking-widest">
                  Page {pageNumber}: {pageFoundation.title}
                </p>
                <p className="text-xs text-muted-foreground">{pageFoundation.direction}</p>
                <p className="text-xs text-muted-foreground/80 italic">Visual: {pageFoundation.visualMetaphor}</p>
              </div>
            )}

            {/* Page config */}
            <div className={D.card}>
              <p className={D.sect}>Page Config</p>
              <div className="grid grid-cols-3 gap-2">
                {numInput('Page #',       pageNumber,   setPageNumber,   1)}
                {numInput('Photo slots',  photoSlots,   setPhotoSlots,   0)}
                {numInput('SVG elements', svgElements,  setSvgElements,  0)}
              </div>
              <div>
                <label className={D.label}>Base URL</label>
                <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
                  className={D.input} placeholder="https://.../template_pages/my-template" />
              </div>
              <div>
                <label className={D.label}>Default font family</label>
                <input value={fontFamily} onChange={e => setFontFamily(e.target.value)} className={D.input} />
              </div>
            </div>

            {/* Default variance */}
            <div className={D.card}>
              <p className={D.sect}>Default Block Variance</p>
              <p className="text-[11px] text-muted-foreground/80">Applied to all blocks unless overridden per-block.</p>
              <RangeInput label="X offset"  value={defX} onChange={setDefX} />
              <RangeInput label="Y offset"  value={defY} onChange={setDefY} />
              <RangeInput label="Rotation"  value={defR} onChange={setDefR} />
            </div>

            {/* Colour groups */}
            <div className={D.card}>
              <p className={D.sect}>Colour Groups</p>
              <p className="text-[11px] text-muted-foreground/80">
                Each group is a set of hex codes that the SVG palette system cycles through per user.
                Group IDs are stored as the <code className="bg-muted px-1 rounded text-gold">paletteGroup</code> value in the JSON.
              </p>
              <ColourGroupEditor groups={colourGroups} onChange={setColourGroups} />
            </div>

            {/* Text blocks */}
            <div className={D.card}>
              <div className="flex items-center justify-between">
                <p className={D.sect}>Text Blocks ({textInputs.length})</p>
                <button type="button" onClick={addText}
                  className="flex items-center gap-1 text-[11px] text-gold hover:opacity-80">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {textInputs.map((ti, i) => (
                  <div key={i} className="relative">
                    <TextRow ti={ti} idx={i}
                      onChange={v => setTextInputs(prev => prev.map((t, idx) => idx === i ? v : t))} />
                    {textInputs.length > 1 && (
                      <button type="button"
                        onClick={() => setTextInputs(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-foreground flex items-center justify-center text-[10px]">
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Image / SVG slots variance */}
            {totalSlots > 0 && (
              <div className={D.card}>
                <p className={D.sect}>Image & SVG Slot Variance</p>
                <div className="space-y-2">
                  {syncedSlots.map((slot, i) => (
                    <ImageSlotRow
                      key={i}
                      slot={slot}
                      idx={i < photoSlots ? i : i - photoSlots}
                      label={i < photoSlots ? 'Photo' : 'SVG'}
                      onChange={v => setImageSlots(prev => {
                        const copy = [...prev];
                        while (copy.length < totalSlots) copy.push({});
                        copy[i] = v;
                        return copy;
                      })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Design elements */}
            <div className={D.card}>
              <div className="flex items-center justify-between">
                <p className={D.sect}>Design Elements ({designElements.length})</p>
                <button type="button" onClick={addElement}
                  className="flex items-center gap-1 text-[11px] text-gold hover:opacity-80">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {designElements.map((el, i) => (
                  <DesignElemRow key={i} el={el} idx={i}
                    onChange={v => setDesignElements(prev => prev.map((e, idx) => idx === i ? v : e))}
                    onRemove={() => setDesignElements(prev => prev.filter((_, idx) => idx !== i))}
                  />
                ))}
                {!designElements.length && (
                  <p className="text-center text-xs text-muted-foreground/60 py-3">Add lines, shapes or dot grids.</p>
                )}
              </div>
            </div>

          </div>

          {/* ── Right: output ── */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <button type="button"
                onClick={() => { setShowResolved(v => !v); }}
                className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors">
                <Eye className="h-3.5 w-3.5" />
                {showResolved ? 'Hide Resolved' : 'Preview Resolved'}
              </button>
            </div>

            <JsonOutput text={jsonText} label="Variadic layout JSON → save to template_pages.layout_json" />

            {showResolved && resolvedJson && (
              <JsonOutput text={resolvedJson} label="Resolved preview (random seed)" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}