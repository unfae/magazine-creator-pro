// src/pages/studio/PageBuilder.tsx — dark theme, option-array approach
// No variance ranges. x/y/width/height are option arrays [v0, v1, v2...].
// Design elements removed — use SVG slots instead.

import { useMemo, useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Copy, Eye, Plus, Trash2, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { toast } from 'sonner';

// ── Dark theme constants ──────────────────────────────────────────────────────
const D = {
  page:   'min-h-screen bg-background text-foreground dark',
  card:   'rounded-xl border border-border bg-card p-4 space-y-3',
  label:  'block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1',
  input:  'w-full rounded-md border border-input bg-muted px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold transition-colors',
  sect:   'text-[10px] font-bold text-gold uppercase tracking-widest',
  chip:   'flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[11px] text-foreground',
  pill:   (on: boolean) => `px-2.5 py-1 rounded-full text-[11px] border transition-colors cursor-pointer ${on ? 'bg-gold border-gold text-black font-medium' : 'border-border text-muted-foreground hover:border-gold hover:text-foreground'}`,
};

// ── Shared helpers ────────────────────────────────────────────────────────────

// Tag input — type and press Enter
function TagInput({ tags, onChange, placeholder, isColor }: {
  tags: string[]; onChange: (t: string[]) => void;
  placeholder?: string; isColor?: boolean;
}) {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  function commit() {
    const v = val.trim(); if (v && !tags.includes(v)) onChange([...tags, v]); setVal('');
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
            className="text-muted-foreground hover:text-foreground ml-0.5 leading-none">×</button>
        </span>
      ))}
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={onKey} onBlur={() => val.trim() && commit()}
        placeholder={tags.length ? '' : (placeholder ?? 'Type → Enter')}
        className="flex-1 min-w-[80px] bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none" />
    </div>
  );
}

// Option input — comma-separated values stored as array
// Shows each value as a numbered chip; used for x, y, width, height, color, etc.
function OptionInput({ label, hint, value, onChange, type = 'text', placeholder }: {
  label: string; hint?: string;
  value: (string | number)[] | string | number | null | undefined;
  onChange: (v: (string | number)[] | string | number) => void;
  type?: 'text' | 'number'; placeholder?: string;
}) {
  const arr = Array.isArray(value) ? value : value != null ? [value] : [];
  const [input, setInput] = useState('');

  function add() {
    const v = input.trim(); if (!v) return;
    const parsed = type === 'number' ? Number(v) : v;
    onChange([...arr, parsed]);
    setInput('');
  }
  function remove(i: number) {
    const next = arr.filter((_, idx) => idx !== i);
    onChange(next.length === 1 ? next[0] : next.length === 0 ? '' : next);
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !input && arr.length) remove(arr.length - 1);
  }

  return (
    <div className="space-y-1">
      <label className={D.label}>{label}{hint && <span className="normal-case font-normal text-muted-foreground/60 ml-1">— {hint}</span>}</label>
      <div className="flex flex-wrap gap-1 rounded-md border border-input bg-muted p-1.5 min-h-[32px] cursor-text focus-within:border-gold transition-colors"
        onClick={() => {}}>
        {arr.map((v, i) => (
          <span key={i} className="flex items-center gap-1 rounded-sm bg-background border border-border px-1.5 py-0.5 text-[10px] font-mono text-foreground">
            <span className="text-muted-foreground/50">{i}:</span>{String(v)}
            <button type="button" onClick={() => remove(i)}
              className="text-muted-foreground/50 hover:text-foreground leading-none ml-0.5">×</button>
          </span>
        ))}
        <input
          type={type}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => input.trim() && add()}
          placeholder={arr.length ? '+' : (placeholder ?? '0')}
          className="flex-1 min-w-[40px] bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
        />
      </div>
    </div>
  );
}

// Corner radius — Figma-style: one value for all, or unlock per-corner
function CornerRadiusInput({ value, onChange }: {
  value: string | number | (string | number)[] | undefined;
  onChange: (v: string | number | (string | number)[]) => void;
}) {
  const isArray = Array.isArray(value);

  // Parse current value into 4-corner state
  const toFour = (v: any): [string, string, string, string] => {
    if (!v && v !== 0) return ['0', '0', '0', '0'];
    if (Array.isArray(v)) return [...v.map(String), '0', '0', '0', '0'].slice(0, 4) as any;
    const s = String(v);
    const parts = s.split(' ');
    if (parts.length === 4) return parts as any;
    return [s, s, s, s];
  };

  const [uniform, setUniform] = useState(!isArray && !String(value ?? '').includes(' '));
  const [corners, setCorners] = useState(toFour(value));
  const [single, setSingle] = useState(isArray ? '' : Array.isArray(value) ? '0' : String(value ?? '0'));

  function emitUniform(v: string) {
    setSingle(v);
    onChange(isArray ? [v] : v);
  }
  function emitCorners(c: typeof corners) {
    setCorners(c);
    const all = c.every(x => x === c[0]);
    onChange(all ? c[0] : c.join(' '));
  }

  // For option array mode — show simple OptionInput instead
  if (isArray) {
    return (
      <OptionInput label="Border radius" hint="option array e.g. 0, 50%, 20px 0 20px 0"
        value={value as any} onChange={onChange} placeholder="0" />
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className={D.label}>Corner radius</label>
        <button type="button" onClick={() => setUniform(v => !v)}
          className="text-[10px] text-muted-foreground hover:text-gold transition-colors">
          {uniform ? '⊞ Per corner' : '⊟ Uniform'}
        </button>
      </div>
      {uniform ? (
        <div className="flex items-center gap-2">
          <input value={single} onChange={e => emitUniform(e.target.value)}
            placeholder="0" className={D.input + ' w-24'} />
          <span className="text-[10px] text-muted-foreground">all corners</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {['TL', 'TR', 'BR', 'BL'].map((lbl, i) => (
            <div key={lbl} className="flex items-center gap-1">
              <span className="text-[9px] text-muted-foreground/60 w-5 shrink-0">{lbl}</span>
              <input value={corners[i]} onChange={e => {
                const c = [...corners] as typeof corners; c[i] = e.target.value; emitCorners(c);
              }} placeholder="0" className={D.input + ' flex-1'} />
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => {
        const next = !Array.isArray(value);
        if (next) onChange([String(single || '0')]);
        else onChange(single || '0');
      }} className="text-[10px] text-muted-foreground hover:text-gold transition-colors">
        {Array.isArray(value) ? '− Remove option array' : '+ Make option array'}
      </button>
    </div>
  );
}

// Shadow input — checkbox to enable, then details
function ShadowInput({ value, onChange }: {
  value: string | (string | null)[] | null | undefined;
  onChange: (v: string | (string | null)[] | null) => void;
}) {
  const enabled = value != null && value !== '';
  const isArr = Array.isArray(value);
  const [blur, setBlur]     = useState('20');
  const [spread, setSpread] = useState('0');
  const [x, setX]           = useState('0');
  const [y, setY]           = useState('4');
  const [color, setColor]   = useState('rgba(0,0,0,0.25)');

  function buildShadow() { return `${x}px ${y}px ${blur}px ${spread}px ${color}`; }

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={enabled}
          onChange={e => onChange(e.target.checked ? buildShadow() : null)}
          className="accent-gold h-3 w-3" />
        <span className={D.label.replace('mb-1', '') + ' cursor-pointer'}>Shadow</span>
        {enabled && !isArr && (
          <button type="button" onClick={() => onChange([buildShadow(), null])}
            className="text-[10px] text-muted-foreground hover:text-gold ml-auto">+ option array</button>
        )}
      </label>
      {enabled && !isArr && (
        <div className="grid grid-cols-4 gap-1 pl-5">
          {[['X', x, setX], ['Y', y, setY], ['Blur', blur, setBlur], ['Spread', spread, setSpread]].map(([lbl, val, set]) => (
            <div key={lbl as string}>
              <label className="text-[9px] text-muted-foreground/60">{lbl as string}</label>
              <input value={val as string} onChange={e => { (set as any)(e.target.value); onChange(buildShadow()); }}
                className={D.input} />
            </div>
          ))}
          <div className="col-span-4">
            <label className="text-[9px] text-muted-foreground/60">Color</label>
            <input value={color} onChange={e => { setColor(e.target.value); onChange(buildShadow()); }}
              className={D.input} placeholder="rgba(0,0,0,0.25)" />
          </div>
        </div>
      )}
      {isArr && (
        <div className="pl-5">
          <OptionInput label="Shadow options (null = no shadow)" value={value as any} onChange={onChange as any} placeholder="null or 0 4px 20px rgba(0,0,0,0.3)" />
        </div>
      )}
    </div>
  );
}

// ── Text block row ────────────────────────────────────────────────────────────
const TEXT_TYPES = ['required', 'ai', 'optional'] as const;
type TextType = typeof TEXT_TYPES[number];

interface TextBlockDef {
  id: string;
  defaultText: string;
  x: any; y: any; width: any; height: any;
  fontSize: any; fontFamily: string[];
  fontWeight: string; color: any;
  align: string; zIndex: number;
  lineHeight: string; letterSpacing: string;
  rotate: any;
  profileField?: string;
  aiHint?: string;
  paletteRole?: string;
  fill?: any;
  shadow?: any;
  textType: TextType;
}

const defaultTextBlock = (): TextBlockDef => ({
  id: 'text_id', defaultText: '',
  x: 40, y: 40, width: 920, height: 70,
  fontSize: 24, fontFamily: [], fontWeight: '500',
  color: '#000000', align: 'left', zIndex: 10,
  lineHeight: '30', letterSpacing: '0', rotate: 0,
  textType: 'required',
});

function TextRow({ tb, idx, onChange }: { tb: TextBlockDef; idx: number; onChange: (v: TextBlockDef) => void }) {
  const [open, setOpen] = useState(false);
  const s = (k: keyof TextBlockDef, v: any) => onChange({ ...tb, [k]: v });

  const typeColors: Record<TextType, string> = {
    required: 'text-gold',
    ai:       'text-blue-400',
    optional: 'text-muted-foreground',
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(v => !v)} className="text-muted-foreground hover:text-foreground">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <input value={tb.id} onChange={e => s('id', e.target.value)}
          className="w-32 rounded border border-border bg-background px-2 py-0.5 text-[11px] text-gold font-mono focus:outline-none focus:border-gold"
          placeholder="field_id" />
        <input value={tb.defaultText} onChange={e => s('defaultText', e.target.value)}
          className={D.input + ' flex-1'} placeholder="Default / placeholder text" />
        {/* Type badge */}
        <div className="flex gap-1">
          {TEXT_TYPES.map(t => (
            <button key={t} type="button" onClick={() => s('textType', t)}
              className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${tb.textType === t ? 'bg-card border-border ' + typeColors[t] : 'border-transparent text-muted-foreground/40 hover:text-muted-foreground'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {open && (
        <div className="space-y-3 pl-5 pt-1">
          {/* Position & size — option arrays */}
          <div className="grid grid-cols-2 gap-2">
            <OptionInput label="x" value={tb.x} onChange={v => s('x', v)} type="number" />
            <OptionInput label="y" value={tb.y} onChange={v => s('y', v)} type="number" />
            <OptionInput label="width" value={tb.width} onChange={v => s('width', v)} type="number" />
            <OptionInput label="height" value={tb.height} onChange={v => s('height', v)} type="number" />
          </div>

          {/* Typography */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={D.label}>Font families</label>
              <TagInput tags={tb.fontFamily} onChange={v => s('fontFamily', v)} placeholder="Playfair Display" />
            </div>
            <div className="space-y-2">
              <OptionInput label="font size" value={tb.fontSize} onChange={v => s('fontSize', v)} type="number" />
              <div>
                <label className={D.label}>Weight</label>
                <input value={tb.fontWeight} onChange={e => s('fontWeight', e.target.value)}
                  className={D.input} placeholder="400" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <OptionInput label="color" value={tb.color} onChange={v => s('color', v)} placeholder="#000000" />
            <div>
              <label className={D.label}>Align</label>
              <div className="flex gap-1">
                {['left','center','right'].map(a => (
                  <button key={a} type="button" onClick={() => s('align', a)}
                    className={D.pill(tb.align === a)}>{a[0].toUpperCase()}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={D.label}>Line height</label>
              <input value={tb.lineHeight} onChange={e => s('lineHeight', e.target.value)} className={D.input} />
            </div>
            <div>
              <label className={D.label}>Letter spacing</label>
              <input value={tb.letterSpacing} onChange={e => s('letterSpacing', e.target.value)} className={D.input} />
            </div>
            <OptionInput label="z-index" value={tb.zIndex} onChange={v => s('zIndex', v)} type="number" />
          </div>

          <OptionInput label="rotate" value={tb.rotate} onChange={v => s('rotate', v)} type="number" placeholder="0" />

          {/* Fill background */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!tb.fill}
                onChange={e => s('fill', e.target.checked ? [{ color: '#ffffff', borderRadius: 4, padding: 8 }, null] : null)}
                className="accent-gold h-3 w-3" />
              <span className={D.label.replace('mb-1','') + ' cursor-pointer'}>Background fill</span>
            </label>
            {tb.fill && (
              <div className="pl-5 grid grid-cols-3 gap-1.5 pt-1">
                <OptionInput label="fill color" value={Array.isArray(tb.fill) ? tb.fill.map((f: any) => f?.color ?? 'null') : tb.fill?.color} onChange={() => {}} placeholder="#fff" />
                <div>
                  <label className={D.label}>Padding</label>
                  <input type="number" defaultValue={8} className={D.input} />
                </div>
                <div>
                  <label className={D.label}>Radius</label>
                  <input type="number" defaultValue={4} className={D.input} />
                </div>
              </div>
            )}
          </div>

          <ShadowInput value={tb.shadow} onChange={v => s('shadow', v)} />

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={D.label}>Profile field</label>
              <input value={tb.profileField ?? ''} onChange={e => s('profileField', e.target.value || undefined)}
                className={D.input} placeholder="full_name" />
            </div>
            <div>
              <label className={D.label}>AI hint</label>
              <input value={tb.aiHint ?? ''} onChange={e => s('aiHint', e.target.value || undefined)}
                className={D.input} placeholder="short, max 6 words" />
            </div>
            <div>
              <label className={D.label}>Palette role</label>
              <input value={tb.paletteRole ?? ''} onChange={e => s('paletteRole', e.target.value || undefined)}
                className={D.input} placeholder="text / accent" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SVG / image slot row ──────────────────────────────────────────────────────
interface SlotDef {
  id: string;
  x: any; y: any; width: any; height: any;
  zIndex: number; rotate: any;
  borderRadius: any;
  shadow?: any;
  maskGroup?: string;
  maskVariant?: any;  // option array of variant numbers
  paletteRole?: string;
  editable: boolean;
}

const defaultSlot = (i: number, editable: boolean): SlotDef => ({
  id: editable ? `photo_${i + 1}` : `svg_${i + 1}`,
  x: 0, y: 0, width: 1000, height: 1415,
  zIndex: i + 1, rotate: 0, borderRadius: 0,
  editable,
});

function SlotRow({ slot, idx, label, onChange }: {
  slot: SlotDef; idx: number; label: string; onChange: (v: SlotDef) => void;
}) {
  const [open, setOpen] = useState(false);
  const s = (k: keyof SlotDef, v: any) => onChange({ ...slot, [k]: v });

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(v => !v)} className="text-muted-foreground hover:text-foreground">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <input value={slot.id} onChange={e => s('id', e.target.value)}
          className="w-32 rounded border border-border bg-background px-2 py-0.5 text-[11px] text-gold font-mono focus:outline-none focus:border-gold"
          placeholder="slot_id" />
        <span className="text-[11px] text-muted-foreground">{label} {idx + 1}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {[Array.isArray(slot.x) && 'x[]', Array.isArray(slot.y) && 'y[]', slot.maskGroup && `mask:${slot.maskGroup}`].filter(Boolean).join(' ')}
        </span>
      </div>

      {open && (
        <div className="space-y-3 pl-5 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <OptionInput label="x" value={slot.x} onChange={v => s('x', v)} type="number" />
            <OptionInput label="y" value={slot.y} onChange={v => s('y', v)} type="number" />
            <OptionInput label="width" value={slot.width} onChange={v => s('width', v)} type="number" />
            <OptionInput label="height" value={slot.height} onChange={v => s('height', v)} type="number" />
            <OptionInput label="z-index" value={slot.zIndex} onChange={v => s('zIndex', v)} type="number" />
            <OptionInput label="rotate" value={slot.rotate} onChange={v => s('rotate', v)} type="number" placeholder="0" />
          </div>

          <CornerRadiusInput value={slot.borderRadius} onChange={v => s('borderRadius', v)} />
          <ShadowInput value={slot.shadow} onChange={v => s('shadow', v)} />

          {!slot.editable && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={D.label}>Mask group</label>
                <input value={slot.maskGroup ?? ''} onChange={e => s('maskGroup', e.target.value || undefined)}
                  className={D.input} placeholder="1A" />
              </div>
              <OptionInput label="mask variant" hint="which svg variant per layout option"
                value={slot.maskVariant} onChange={v => s('maskVariant', v)} type="number" placeholder="1" />
            </div>
          )}

          <div>
            <label className={D.label}>Palette role</label>
            <input value={slot.paletteRole ?? ''} onChange={e => s('paletteRole', e.target.value || undefined)}
              className={D.input} placeholder="primary / accent" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Colour groups ─────────────────────────────────────────────────────────────
interface ColourGroup { id: string; colors: string[] }

function ColourGroupEditor({ groups, onChange }: { groups: ColourGroup[]; onChange: (g: ColourGroup[]) => void }) {
  return (
    <div className="space-y-2">
      {groups.map((g, i) => (
        <div key={i} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input value={g.id} onChange={e => onChange(groups.map((x, idx) => idx === i ? { ...x, id: e.target.value } : x))}
              className="w-24 rounded border border-border bg-background px-2 py-0.5 text-[11px] text-gold font-mono focus:outline-none"
              placeholder="group_1" />
            <div className="flex gap-0.5">
              {g.colors.map(c => <span key={c} className="w-3 h-3 rounded-sm" style={{ background: c }} />)}
            </div>
            <button type="button" onClick={() => onChange(groups.filter((_, idx) => idx !== i))}
              className="ml-auto text-destructive/60 hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <TagInput tags={g.colors} onChange={v => onChange(groups.map((x, idx) => idx === i ? { ...x, colors: v } : x))}
            placeholder="#C69339 → Enter" isColor />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...groups, { id: `group_${groups.length + 1}`, colors: [] }])}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:text-gold hover:border-gold transition-colors">
        <Plus className="h-3.5 w-3.5" /> Add colour group
      </button>
    </div>
  );
}

// ── Editable JSON output ──────────────────────────────────────────────────────
function JsonOutput({ text, label }: { text: string; label: string }) {
  const [edited, setEdited] = useState(text);
  const [valid, setValid]   = useState(true);
  const prevRef = useRef(text);

  useEffect(() => {
    if (text !== prevRef.current) { setEdited(text); prevRef.current = text; setValid(true); }
  }, [text]);

  function handleChange(val: string) {
    setEdited(val);
    try { JSON.parse(val); setValid(true); } catch { setValid(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(edited); toast.success('Copied!'); }
    catch { toast.error('Copy failed'); }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold text-gold uppercase tracking-widest flex-1 truncate">{label}</p>
        <div className="flex items-center gap-2 shrink-0">
          {!valid && <span className="text-[10px] text-destructive font-medium">Invalid JSON</span>}
          {edited !== text && (
            <button type="button" onClick={() => { setEdited(text); setValid(true); }}
              className="text-[11px] text-muted-foreground hover:text-foreground">Reset</button>
          )}
          <button type="button" onClick={copy}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <Copy className="h-3 w-3" /> Copy
          </button>
        </div>
      </div>
      <textarea
        value={edited}
        onChange={e => handleChange(e.target.value)}
        spellCheck={false}
        className={`min-h-[420px] max-h-[640px] w-full rounded-lg bg-background p-3 text-[11px] leading-relaxed font-mono resize-y focus:outline-none border transition-colors ${valid ? 'border-border focus:border-gold' : 'border-destructive/60'}`}
      />
    </div>
  );
}

// ── Build JSON from state ─────────────────────────────────────────────────────
function buildLayout(params: {
  pageNumber: number; totalVariants: number;
  photoSlots: SlotDef[]; svgSlots: SlotDef[];
  textBlocks: TextBlockDef[]; baseUrl: string;
  colourGroups: ColourGroup[]; background: any;
}) {
  const { pageNumber, totalVariants, photoSlots, svgSlots, textBlocks, baseUrl, colourGroups, background } = params;

  const indexToLetter = (i: number) => {
    let r = ''; let n = i;
    do { r = String.fromCharCode(65 + (n % 26)) + r; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return r;
  };
  const joinUrl = (base: string, path: string) => `${base.replace(/\/+$/, '')}/${path}`;

  let letterIdx = 0;

  const imageBlocks = [
    ...photoSlots.map((slot) => {
      const letter = indexToLetter(letterIdx++);
      const out: any = {
        id: slot.id, x: slot.x, y: slot.y, width: slot.width, height: slot.height,
        zIndex: slot.zIndex, rotate: slot.rotate, borderRadius: slot.borderRadius,
        editable: true,
        defaultImageUrl: joinUrl(baseUrl, `${pageNumber}${letter}.png`),
      };
      if (slot.shadow) out.shadow = slot.shadow;
      if (slot.paletteRole) out.paletteRole = slot.paletteRole;
      return out;
    }),
    ...svgSlots.map((slot) => {
      const letter = indexToLetter(letterIdx++);
      const out: any = {
        id: slot.id, x: slot.x, y: slot.y, width: slot.width, height: slot.height,
        zIndex: slot.zIndex, rotate: slot.rotate, borderRadius: slot.borderRadius,
        editable: false,
        defaultImageUrl: joinUrl(baseUrl, `${pageNumber}${letter}.svg`),
      };
      if (slot.maskGroup) {
        out.maskGroup   = slot.maskGroup;
        out.maskVariant = slot.maskVariant ?? 1;
      }
      if (slot.shadow) out.shadow = slot.shadow;
      if (slot.paletteRole) out.paletteRole = slot.paletteRole;
      return out;
    }),
  ];

  // Pagination for pages 2+
  if (pageNumber > 1) {
    imageBlocks.push({
      id: 'pagination', x: 10, y: 1376, width: 980, height: 29,
      zIndex: 50, rotate: 0, borderRadius: 0, editable: false,
      defaultImageUrl: joinUrl(baseUrl, `Page${pageNumber}.png`),
    });
  }

  const tBlocks = textBlocks.map(tb => {
    const out: any = {
      id: tb.id, defaultText: tb.defaultText,
      x: tb.x, y: tb.y, width: tb.width, height: tb.height,
      fontSize: tb.fontSize,
      fontFamily: tb.fontFamily.length === 1 ? tb.fontFamily[0] : tb.fontFamily.length > 1 ? tb.fontFamily : undefined,
      fontWeight: tb.fontWeight, color: tb.color, align: tb.align,
      zIndex: tb.zIndex, lineHeight: tb.lineHeight, letterSpacing: tb.letterSpacing,
      rotate: tb.rotate, editable: true,
      type: tb.textType,
    };
    if (tb.profileField) out.profileField = tb.profileField;
    if (tb.aiHint)       out.aiHint = tb.aiHint;
    if (tb.paletteRole)  out.paletteRole = tb.paletteRole;
    if (tb.fill)         out.fill = tb.fill;
    if (tb.shadow)       out.shadow = tb.shadow;
    return out;
  });

  const paletteGroup = colourGroups.length
    ? Object.fromEntries(colourGroups.map(g => [g.id, g.colors]))
    : undefined;

  const layout: any = { _variants: totalVariants, imageBlocks, textBlocks: tBlocks };
  if (background) layout.background = background;
  if (paletteGroup) layout.paletteGroup = paletteGroup;

  return layout;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PageBuilder() {
  const location   = useLocation();
  const foundation = (location.state as any)?.foundation;
  const brief      = (location.state as any)?.brief;

  const [pageNumber, setPageNumber] = useState(1);
  const [totalVariants, setTotalVariants] = useState(2);
  const [baseUrl, setBaseUrl]       = useState('');
  const [background, setBackground] = useState<any>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [resolvedV, setResolvedV]   = useState(0); // which variant index to preview

  const [photoSlots, setPhotoSlots] = useState<SlotDef[]>([defaultSlot(0, true)]);
  const [svgSlots, setSvgSlots]     = useState<SlotDef[]>([]);
  const [textBlocks, setTextBlocks] = useState<TextBlockDef[]>([defaultTextBlock()]);
  const [colourGroups, setColourGroups] = useState<ColourGroup[]>([]);

  const pageFoundation = foundation?.pages?.find((p: any) => p.pageNumber === pageNumber);

  const layout = useMemo(() => buildLayout({
    pageNumber, totalVariants, photoSlots, svgSlots, textBlocks, baseUrl, colourGroups, background,
  }), [pageNumber, totalVariants, photoSlots, svgSlots, textBlocks, baseUrl, colourGroups, background]);

  // Simple index-based resolver for preview
  const resolvedLayout = useMemo(() => {
    if (!showResolved) return null;
    const v = resolvedV % totalVariants;
    function pick(val: any): any {
      if (Array.isArray(val)) return val[v % val.length];
      return val;
    }
    function resolveBlock(block: any) {
      const out: any = {};
      for (const [k, val] of Object.entries(block)) out[k] = pick(val);
      return out;
    }
    return {
      ...layout,
      background: pick(layout.background),
      imageBlocks: layout.imageBlocks.map(resolveBlock),
      textBlocks: layout.textBlocks.map(resolveBlock),
    };
  }, [showResolved, resolvedV, layout, totalVariants]);

  const jsonText     = useMemo(() => JSON.stringify(layout, null, 2), [layout]);
  const resolvedJson = useMemo(() => resolvedLayout ? JSON.stringify(resolvedLayout, null, 2) : '', [resolvedLayout]);

  return (
    <div className={D.page}>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6">
          <p className="text-[10px] text-gold uppercase tracking-widest mb-1">Studio</p>
          <h1 className="text-2xl font-semibold">Page Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">Build layout JSON. Arrays = options picked by variant index v.</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {/* ── Controls ── */}
          <div className="space-y-4">

            {/* Foundation context */}
            {pageFoundation && (
              <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 space-y-1">
                <p className="text-[10px] font-bold text-gold uppercase">{pageFoundation.title}</p>
                <p className="text-xs text-muted-foreground">{pageFoundation.direction}</p>
                <p className="text-xs text-muted-foreground italic">Visual: {pageFoundation.visualMetaphor}</p>
              </div>
            )}

            {/* Page config */}
            <div className={D.card}>
              <p className={D.sect}>Page Config</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={D.label}>Page #</label>
                  <input type="number" min={1} value={pageNumber}
                    onChange={e => setPageNumber(Math.max(1, Number(e.target.value)))} className={D.input} />
                </div>
                <div>
                  <label className={D.label}>Variants (total layouts)</label>
                  <input type="number" min={1} max={10} value={totalVariants}
                    onChange={e => setTotalVariants(Math.max(1, Number(e.target.value)))} className={D.input} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Arrays must have this many items</p>
                </div>
              </div>
              <div>
                <label className={D.label}>Base URL</label>
                <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
                  className={D.input} placeholder="https://.../template_pages/my-template" />
              </div>
              <OptionInput label="Background" hint="hex or option array" value={background}
                onChange={setBackground} placeholder="#ffffff" />
            </div>

            {/* Colour groups */}
            <div className={D.card}>
              <p className={D.sect}>Colour Groups</p>
              <p className="text-[11px] text-muted-foreground">Each group is a palette option users can pick. Stored as paletteGroup in the JSON.</p>
              <ColourGroupEditor groups={colourGroups} onChange={setColourGroups} />
            </div>

            {/* Photo slots */}
            <div className={D.card}>
              <div className="flex items-center justify-between">
                <p className={D.sect}>Photo Slots ({photoSlots.length})</p>
                <button type="button" onClick={() => setPhotoSlots(p => [...p, defaultSlot(p.length, true)])}
                  className="text-[11px] text-gold hover:opacity-80 flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {photoSlots.map((s, i) => (
                  <div key={i} className="relative">
                    <SlotRow slot={s} idx={i} label="Photo"
                      onChange={v => setPhotoSlots(p => p.map((x, idx) => idx === i ? v : x))} />
                    {photoSlots.length > 0 && (
                      <button type="button" onClick={() => setPhotoSlots(p => p.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center text-[10px]">×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* SVG slots */}
            <div className={D.card}>
              <div className="flex items-center justify-between">
                <p className={D.sect}>SVG Elements ({svgSlots.length})</p>
                <button type="button" onClick={() => setSvgSlots(p => [...p, defaultSlot(p.length, false)])}
                  className="text-[11px] text-gold hover:opacity-80 flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {svgSlots.map((s, i) => (
                  <div key={i} className="relative">
                    <SlotRow slot={s} idx={i} label="SVG"
                      onChange={v => setSvgSlots(p => p.map((x, idx) => idx === i ? v : x))} />
                    <button type="button" onClick={() => setSvgSlots(p => p.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center text-[10px]">×</button>
                  </div>
                ))}
                {!svgSlots.length && (
                  <p className="text-center text-xs text-muted-foreground py-2">Add SVG overlays, masks and decorative elements.</p>
                )}
              </div>
            </div>

            {/* Text blocks */}
            <div className={D.card}>
              <div className="flex items-center justify-between">
                <p className={D.sect}>Text Blocks ({textBlocks.length})</p>
                <button type="button" onClick={() => setTextBlocks(p => [...p, defaultTextBlock()])}
                  className="text-[11px] text-gold hover:opacity-80 flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {textBlocks.map((tb, i) => (
                  <div key={i} className="relative">
                    <TextRow tb={tb} idx={i}
                      onChange={v => setTextBlocks(p => p.map((x, idx) => idx === i ? v : x))} />
                    {textBlocks.length > 1 && (
                      <button type="button" onClick={() => setTextBlocks(p => p.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center text-[10px]">×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── Output ── */}
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <button type="button"
                onClick={() => setShowResolved(v => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Eye className="h-3.5 w-3.5" />
                {showResolved ? 'Hide resolved' : 'Preview variant'}
              </button>
              {showResolved && (
                <div className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1">
                  <span className="text-[11px] text-muted-foreground">v =</span>
                  {Array.from({ length: totalVariants }, (_, i) => (
                    <button key={i} type="button" onClick={() => setResolvedV(i)}
                      className={`w-6 h-6 rounded text-[11px] font-mono transition-colors ${resolvedV === i ? 'bg-gold text-black' : 'text-muted-foreground hover:text-foreground'}`}>
                      {i}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <JsonOutput text={jsonText} label="Layout JSON → template_pages.layout_json" />

            {showResolved && resolvedJson && (
              <JsonOutput text={resolvedJson} label={`Resolved preview — variant v=${resolvedV}`} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}