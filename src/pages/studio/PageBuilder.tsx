// src/pages/studio/PageBuilder.tsx

import { useMemo, useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Copy, Eye, Plus, Trash2, ChevronDown, ChevronUp, MoveHorizontal, MoveVertical } from 'lucide-react';
import { toast } from 'sonner';

// ── Dark theme tokens ─────────────────────────────────────────────────────────
const D = {
  page:  'min-h-screen bg-background text-foreground dark',
  card:  'rounded-xl border border-border bg-card p-4 space-y-3',
  label: 'text-[10px] font-semibold text-muted-foreground uppercase tracking-wider',
  input: 'w-full rounded-md border border-input bg-muted px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold transition-colors',
  sect:  'text-[10px] font-bold text-gold uppercase tracking-widest',
  chip:  'flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[11px] text-foreground',
  pill:  (on: boolean) => `px-2.5 py-1 rounded-full text-[11px] border transition-colors cursor-pointer ${on ? 'bg-gold border-gold text-black font-medium' : 'border-border text-muted-foreground hover:border-gold hover:text-foreground'}`,
};

// ── Palette role options ──────────────────────────────────────────────────────
// paletteRole tells the renderer which colour slot from the active palette to use
// for this block's colour/fill, instead of the block's own color value.
// e.g. "accent" → uses palette.colors.accent
const PALETTE_ROLES = ['background', 'primary', 'secondary', 'accent', 'text'] as const;
type PaletteRole = typeof PALETTE_ROLES[number];

function PaletteRoleSelect({ value, onChange }: {
  value?: string; onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={D.label}>Palette role</span>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || undefined)}
        className="flex-1 rounded-md border border-input bg-muted px-2 py-1 text-[11px] text-foreground focus:outline-none focus:border-gold"
      >
        <option value="">none</option>
        {PALETTE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
    </div>
  );
}

// ── Tag input ─────────────────────────────────────────────────────────────────
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
    <div className="flex flex-wrap gap-1 rounded-md border border-input bg-muted p-1.5 min-h-[32px] cursor-text focus-within:border-gold transition-colors"
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
        className="flex-1 min-w-[60px] bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none" />
    </div>
  );
}

// ── Inline option row ─────────────────────────────────────────────────────────
// Label on left, values inline as small chips on the same line.
// One value = scalar. More = option array.
// User types in the box and presses Enter to add. Single value = used for all variants.
function InlineOption({
  label, icon, value, onChange, type = 'text', width = 'w-16', placeholder = '—',
}: {
  label?: string; icon?: React.ReactNode;
  value: any; onChange: (v: any) => void;
  type?: 'text' | 'number'; width?: string; placeholder?: string;
}) {
  const arr   = Array.isArray(value) ? value : value != null && value !== '' ? [value] : [];
  const [inp, setInp] = useState('');

  function add(raw: string) {
    const v = raw.trim(); if (!v) return;
    const parsed = type === 'number' ? (isNaN(Number(v)) ? v : Number(v)) : v;
    const next = [...arr, parsed];
    onChange(next.length === 1 ? next[0] : next);
    setInp('');
  }
  function remove(i: number) {
    const next = arr.filter((_, idx) => idx !== i);
    onChange(next.length === 1 ? next[0] : next.length === 0 ? '' : next);
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(inp); }
    if (e.key === 'Backspace' && !inp && arr.length) remove(arr.length - 1);
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {/* Label / icon */}
      {icon && <span className="text-muted-foreground/60 shrink-0">{icon}</span>}
      {label && !icon && <span className={D.label + ' shrink-0 normal-case'}>{label}</span>}

      {/* Chips inline */}
      <div className="flex items-center gap-0.5 flex-wrap">
        {arr.map((v, i) => (
          <span key={i}
            className="flex items-center gap-0.5 rounded bg-background border border-border px-1 py-0.5 text-[10px] font-mono text-foreground">
            {arr.length > 1 && <span className="text-muted-foreground/40">{i}:</span>}
            {String(v)}
            <button type="button" onClick={() => remove(i)}
              className="text-muted-foreground/40 hover:text-foreground leading-none">×</button>
          </span>
        ))}
      </div>

      {/* Input */}
      <input
        type={type === 'number' ? 'text' : 'text'}
        value={inp}
        onChange={e => setInp(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => inp.trim() && add(inp)}
        placeholder={arr.length ? '+' : placeholder}
        className={`${width} rounded border border-input bg-muted px-1.5 py-0.5 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold shrink-0`}
      />
    </div>
  );
}

// ── Compact pos/size row: x y w h on one line ─────────────────────────────────
function PosRow({ x, y, w, h, z, r, onX, onY, onW, onH, onZ, onR }: {
  x: any; y: any; w: any; h: any; z: any; r: any;
  onX(v: any): void; onY(v: any): void; onW(v: any): void;
  onH(v: any): void; onZ(v: any): void; onR(v: any): void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <InlineOption label="x" value={x} onChange={onX} type="number" width="w-14" placeholder="0" />
        <InlineOption label="y" value={y} onChange={onY} type="number" width="w-14" placeholder="0" />
        <InlineOption
          icon={<MoveHorizontal className="h-3 w-3" />}
          value={w} onChange={onW} type="number" width="w-16" placeholder="1000" />
        <InlineOption
          icon={<MoveVertical className="h-3 w-3" />}
          value={h} onChange={onH} type="number" width="w-16" placeholder="1415" />
      </div>
      <div className="flex flex-wrap gap-2">
        <InlineOption label="z" value={z} onChange={onZ} type="number" width="w-10" placeholder="1" />
        <InlineOption label="rot°" value={r} onChange={onR} type="number" width="w-10" placeholder="0" />
      </div>
    </div>
  );
}

// ── Corner radius — checkbox for uniform ─────────────────────────────────────
function CornerRadius({ value, onChange }: {
  value: any; onChange: (v: any) => void;
}) {
  const isArr  = Array.isArray(value);
  const asStr  = isArr ? '' : String(value ?? '0');
  const parts  = asStr.trim().split(/\s+/);
  const isUniform = parts.length <= 1;
  const [uniform, setUniform] = useState(isUniform);
  const [corners, setCorners] = useState<[string,string,string,string]>(
    parts.length === 4 ? parts as any : [asStr, asStr, asStr, asStr]
  );
  const [single, setSingle] = useState(isUniform ? asStr : parts[0]);

  function emitUniform(v: string) { setSingle(v); onChange(isArr ? [v] : v); }
  function emitCorners(c: typeof corners) {
    setCorners(c);
    onChange(c.every(x => x === c[0]) ? c[0] : c.join(' '));
  }

  if (isArr) {
    return (
      <InlineOption label="radius" value={value} onChange={onChange} placeholder="0" />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input type="checkbox" checked={uniform}
          onChange={e => { setUniform(e.target.checked); if (e.target.checked) emitUniform(corners[0]); }}
          className="accent-gold h-3 w-3" />
        <span className={D.label + ' normal-case cursor-pointer'}>All corners</span>
      </label>
      {uniform ? (
        <input value={single} onChange={e => emitUniform(e.target.value)}
          placeholder="0" className="w-20 rounded border border-input bg-muted px-2 py-1 text-xs focus:outline-none focus:border-gold" />
      ) : (
        <div className="flex gap-1">
          {['TL','TR','BR','BL'].map((lbl, i) => (
            <div key={lbl} className="flex items-center gap-0.5">
              <span className="text-[9px] text-muted-foreground/50">{lbl}</span>
              <input value={corners[i]} onChange={e => {
                const c = [...corners] as typeof corners; c[i] = e.target.value; emitCorners(c);
              }} className="w-12 rounded border border-input bg-muted px-1.5 py-1 text-xs focus:outline-none focus:border-gold" />
            </div>
          ))}
        </div>
      )}
      <button type="button"
        onClick={() => onChange(Array.isArray(value) ? String(single || '0') : [String(single || '0')])}
        className="text-[10px] text-muted-foreground hover:text-gold transition-colors ml-auto">
        {Array.isArray(value) ? '− array' : '+ variants'}
      </button>
    </div>
  );
}

// ── Shadow ────────────────────────────────────────────────────────────────────
function ShadowControl({ value, onChange }: {
  value: any; onChange: (v: any) => void;
}) {
  const enabled = value != null && value !== '';
  const isArr   = Array.isArray(value);
  const [x, setX] = useState('0'); const [y, setY] = useState('4');
  const [blur, setBlur] = useState('20'); const [spread, setSpread] = useState('0');
  const [col, setCol] = useState('rgba(0,0,0,0.25)');

  const build = () => `${x}px ${y}px ${blur}px ${spread}px ${col}`;

  return (
    <div className="flex flex-wrap items-start gap-2">
      <label className="flex items-center gap-1.5 cursor-pointer shrink-0 pt-1">
        <input type="checkbox" checked={enabled}
          onChange={e => onChange(e.target.checked ? build() : null)}
          className="accent-gold h-3 w-3" />
        <span className={D.label + ' normal-case cursor-pointer'}>Shadow</span>
      </label>
      {enabled && !isArr && (
        <div className="flex flex-wrap gap-1.5 flex-1">
          {[['x', x, setX], ['y', y, setY], ['blur', blur, setBlur], ['spread', spread, setSpread]].map(([lbl, val, set]) => (
            <div key={lbl as string} className="flex items-center gap-1">
              <span className="text-[9px] text-muted-foreground/50">{lbl as string}</span>
              <input value={val as string}
                onChange={e => { (set as any)(e.target.value); onChange(build()); }}
                className="w-12 rounded border border-input bg-muted px-1.5 py-0.5 text-[11px] focus:outline-none" />
            </div>
          ))}
          <input value={col} onChange={e => { setCol(e.target.value); onChange(build()); }}
            className="w-36 rounded border border-input bg-muted px-1.5 py-0.5 text-[11px] focus:outline-none" placeholder="rgba(0,0,0,0.25)" />
          <button type="button" onClick={() => onChange([build(), null])}
            className="text-[10px] text-muted-foreground hover:text-gold">+ variants</button>
        </div>
      )}
      {isArr && (
        <InlineOption label="" value={value} onChange={onChange} placeholder="null or 0 4px 20px rgba(0,0,0,0.25)" />
      )}
    </div>
  );
}

// ── Text block row ────────────────────────────────────────────────────────────
const TEXT_TYPES = ['required', 'ai', 'optional'] as const;
type TextType = typeof TEXT_TYPES[number];

interface TextBlockDef {
  id: string; defaultText: string;
  x: any; y: any; width: any; height: any;
  fontSize: any; fontFamily: string[];
  fontWeight: string; color: any;
  align: string; zIndex: any;
  lineHeight: string; letterSpacing: string; rotate: any;
  profileField?: string; aiHint?: string; paletteRole?: string;
  fill?: any; shadow?: any; textType: TextType;
}

const newText = (): TextBlockDef => ({
  id: '', defaultText: '',
  x: '', y: '', width: '', height: '',
  fontSize: '', fontFamily: [], fontWeight: '500',
  color: '', align: 'left', zIndex: '',
  lineHeight: '', letterSpacing: '0', rotate: '',
  textType: 'required',
});

function TextRow({ tb, onChange }: { tb: TextBlockDef; onChange: (v: TextBlockDef) => void }) {
  const [open, setOpen] = useState(false);
  const s = (k: keyof TextBlockDef, v: any) => onChange({ ...tb, [k]: v });
  const typeColor: Record<TextType, string> = { required: 'text-gold', ai: 'text-blue-400', optional: 'text-muted-foreground/60' };

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => setOpen(v => !v)} className="text-muted-foreground hover:text-foreground shrink-0">
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <input value={tb.id} onChange={e => s('id', e.target.value)}
          className="w-28 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-gold font-mono focus:outline-none focus:border-gold shrink-0"
          placeholder="field_id" />
        <input value={tb.defaultText} onChange={e => s('defaultText', e.target.value)}
          className={D.input + ' flex-1 min-w-0'} placeholder="Default text" />
        <div className="flex shrink-0">
          {TEXT_TYPES.map(t => (
            <button key={t} type="button" onClick={() => s('textType', t)}
              className={`text-[9px] px-1 py-0.5 transition-colors ${tb.textType === t ? typeColor[t] + ' font-bold' : 'text-muted-foreground/30 hover:text-muted-foreground'}`}>
              {t[0].toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {open && (
        <div className="space-y-2.5 pl-5 pt-0.5 border-t border-border/50">
          <PosRow x={tb.x} y={tb.y} w={tb.width} h={tb.height} z={tb.zIndex} r={tb.rotate}
            onX={v => s('x', v)} onY={v => s('y', v)} onW={v => s('width', v)}
            onH={v => s('height', v)} onZ={v => s('zIndex', v)} onR={v => s('rotate', v)} />

          {/* Typography */}
          <div className="flex flex-wrap gap-2 items-start">
            <div className="flex-1 min-w-[140px]">
              <p className={D.label + ' mb-1'}>Fonts</p>
              <TagInput tags={tb.fontFamily} onChange={v => s('fontFamily', v)} placeholder="Playfair Display" />
            </div>
            <div className="space-y-1">
              <InlineOption label="size" value={tb.fontSize} onChange={v => s('fontSize', v)} type="number" width="w-12" />
              <InlineOption label="weight" value={tb.fontWeight} onChange={v => s('fontWeight', v)} width="w-12" placeholder="500" />
              <InlineOption label="lh" value={tb.lineHeight} onChange={v => s('lineHeight', v)} width="w-12" placeholder="30" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <InlineOption label="color" value={tb.color} onChange={v => s('color', v)} placeholder="#000" width="w-20" />
            <div className="flex gap-1">
              {['left','center','right'].map(a => (
                <button key={a} type="button" onClick={() => s('align', a)}
                  className={D.pill(tb.align === a)}>{a[0].toUpperCase()}</button>
              ))}
            </div>
          </div>

          {/* Fill */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={!!tb.fill}
              onChange={e => s('fill', e.target.checked ? { color: '#ffffff', borderRadius: 4, padding: 8 } : null)}
              className="accent-gold h-3 w-3" />
            <span className={D.label + ' normal-case cursor-pointer'}>Background fill</span>
            {tb.fill && (
              <input value={tb.fill?.color ?? ''} onChange={e => s('fill', { ...tb.fill, color: e.target.value })}
                className="w-20 rounded border border-input bg-muted px-1.5 py-0.5 text-[11px] focus:outline-none ml-2" placeholder="#fff" />
            )}
          </label>

          <ShadowControl value={tb.shadow} onChange={v => s('shadow', v)} />

          {/* Metadata */}
          <div className="flex flex-wrap gap-2">
            <div className="flex-1">
              <PaletteRoleSelect value={tb.paletteRole} onChange={v => s('paletteRole', v)} />
            </div>
            <InlineOption label="profile" value={tb.profileField ?? ''} onChange={v => s('profileField', v || undefined)} width="w-24" placeholder="full_name" />
          </div>
          <InlineOption label="AI hint" value={tb.aiHint ?? ''} onChange={v => s('aiHint', v || undefined)} width="w-40" placeholder="short, max 6 words" />
        </div>
      )}
    </div>
  );
}

// ── Slot row (photo / svg) ────────────────────────────────────────────────────
interface SlotDef {
  id: string; x: any; y: any; width: any; height: any;
  zIndex: any; rotate: any; borderRadius: any;
  shadow?: any; paletteRole?: string; editable: boolean;
  // Photo-only mask fields
  maskGroup?: string; maskVariant?: any;
}

const newSlot = (i: number, editable: boolean): SlotDef => ({
  id: editable ? `photo_${i + 1}` : `svg_${i + 1}`,
  x: '', y: '', width: '', height: '',
  zIndex: '', rotate: '', borderRadius: 0, editable,
});

function SlotRow({ slot, idx, label, onChange }: {
  slot: SlotDef; idx: number; label: string; onChange: (v: SlotDef) => void;
}) {
  const [open, setOpen] = useState(false);
  const s = (k: keyof SlotDef, v: any) => onChange({ ...slot, [k]: v });
  const isPhoto = slot.editable;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => setOpen(v => !v)} className="text-muted-foreground hover:text-foreground shrink-0">
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <input value={slot.id} onChange={e => s('id', e.target.value)}
          className="w-28 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-gold font-mono focus:outline-none focus:border-gold shrink-0"
          placeholder={label.toLowerCase() + '_id'} />
        <span className="text-[11px] text-muted-foreground">{label} {idx + 1}</span>
        <span className="text-[10px] text-muted-foreground/50 ml-auto font-mono">
          {[Array.isArray(slot.x) && 'x[]', Array.isArray(slot.y) && 'y[]',
            isPhoto && slot.maskGroup && `mask:${slot.maskGroup}`].filter(Boolean).join(' ')}
        </span>
      </div>

      {open && (
        <div className="space-y-2.5 pl-5 pt-0.5 border-t border-border/50">
          <PosRow x={slot.x} y={slot.y} w={slot.width} h={slot.height} z={slot.zIndex} r={slot.rotate}
            onX={v => s('x', v)} onY={v => s('y', v)} onW={v => s('width', v)}
            onH={v => s('height', v)} onZ={v => s('zIndex', v)} onR={v => s('rotate', v)} />

          <CornerRadius value={slot.borderRadius} onChange={v => s('borderRadius', v)} />
          <ShadowControl value={slot.shadow} onChange={v => s('shadow', v)} />
          <PaletteRoleSelect value={slot.paletteRole} onChange={v => s('paletteRole', v)} />

          {/* Mask — photos only */}
          {isPhoto && (
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-1.5">
                <span className={D.label + ' shrink-0'}>Mask group</span>
                <input value={slot.maskGroup ?? ''} onChange={e => s('maskGroup', e.target.value || undefined)}
                  className="w-16 rounded border border-input bg-muted px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-gold"
                  placeholder="1A" />
              </div>
              {slot.maskGroup && (
                <InlineOption label="variant" value={slot.maskVariant ?? 1}
                  onChange={v => s('maskVariant', v)} type="number" width="w-10" placeholder="1" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Colour groups ─────────────────────────────────────────────────────────────
interface ColourGroup { id: string; colors: string[] }

function ColourGroups({ groups, onChange }: { groups: ColourGroup[]; onChange: (g: ColourGroup[]) => void }) {
  return (
    <div className="space-y-2">
      {groups.map((g, i) => (
        <div key={i} className="rounded-lg border border-border bg-muted/20 p-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <input value={g.id} onChange={e => onChange(groups.map((x, idx) => idx === i ? { ...x, id: e.target.value } : x))}
              className="w-20 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-gold font-mono focus:outline-none" placeholder="group_1" />
            <div className="flex gap-0.5">{g.colors.map(c => <span key={c} className="w-3 h-3 rounded-sm border border-white/10" style={{ background: c }} />)}</div>
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
        className="w-full flex items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1.5 text-xs text-muted-foreground hover:text-gold hover:border-gold transition-colors">
        <Plus className="h-3.5 w-3.5" /> Add colour group
      </button>
    </div>
  );
}

// ── Editable JSON output ──────────────────────────────────────────────────────
function JsonOutput({ text, label }: { text: string; label: string }) {
  const [edited, setEdited] = useState(text);
  const [valid, setValid]   = useState(true);
  const prev = useRef(text);

  useEffect(() => { if (text !== prev.current) { setEdited(text); prev.current = text; setValid(true); } }, [text]);

  function onChange(val: string) { setEdited(val); try { JSON.parse(val); setValid(true); } catch { setValid(false); } }
  async function copy() { try { await navigator.clipboard.writeText(edited); toast.success('Copied!'); } catch { toast.error('Failed'); } }

  return (
    <div className={`rounded-xl border bg-card p-4 flex flex-col gap-2 ${valid ? 'border-border' : 'border-destructive/40'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-gold uppercase tracking-widest flex-1 truncate">{label}</p>
        <div className="flex items-center gap-2 shrink-0">
          {!valid && <span className="text-[10px] text-destructive">Invalid JSON</span>}
          {edited !== text && <button type="button" onClick={() => { setEdited(text); setValid(true); }} className="text-[11px] text-muted-foreground hover:text-foreground">Reset</button>}
          <button type="button" onClick={copy} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <Copy className="h-3 w-3" /> Copy
          </button>
        </div>
      </div>
      <textarea value={edited} onChange={e => onChange(e.target.value)} spellCheck={false}
        className="min-h-[420px] max-h-[680px] w-full rounded-lg bg-background p-3 text-[11px] leading-relaxed font-mono resize-y focus:outline-none border border-border focus:border-gold transition-colors" />
    </div>
  );
}

// ── Build JSON ────────────────────────────────────────────────────────────────
function buildLayout(p: {
  pageNumber: number; totalVariants: number;
  photoSlots: SlotDef[]; svgSlots: SlotDef[];
  textBlocks: TextBlockDef[]; baseUrl: string;
  colourGroups: ColourGroup[]; background: any;
}) {
  const letterOf = (i: number) => { let r = ''; let n = i; do { r = String.fromCharCode(65 + (n % 26)) + r; n = Math.floor(n / 26) - 1; } while (n >= 0); return r; };
  const url = (path: string) => `${p.baseUrl.replace(/\/+$/, '')}/${path}`;
  let li = 0;

  function clean(val: any) {
    // If val is '' or [] treat as not set
    if (val === '' || (Array.isArray(val) && val.length === 0)) return undefined;
    return val;
  }

  const imageBlocks = [
    ...p.photoSlots.map(s => {
      const letter = letterOf(li++);
      const out: any = {
        id: s.id || `photo_${li}`,
        x: clean(s.x) ?? 0, y: clean(s.y) ?? 0,
        width: clean(s.width) ?? 1000, height: clean(s.height) ?? 1415,
        zIndex: clean(s.zIndex) ?? 1, rotate: clean(s.rotate) ?? 0,
        borderRadius: s.borderRadius ?? 0,
        editable: true,
        defaultImageUrl: url(`${p.pageNumber}${letter}.png`),
      };
      if (s.shadow) out.shadow = s.shadow;
      if (s.paletteRole) out.paletteRole = s.paletteRole;
      if (s.maskGroup) { out.maskGroup = s.maskGroup; out.maskVariant = clean(s.maskVariant) ?? 1; }
      return out;
    }),
    ...p.svgSlots.map(s => {
      const letter = letterOf(li++);
      const out: any = {
        id: s.id || `svg_${li}`,
        x: clean(s.x) ?? 0, y: clean(s.y) ?? 0,
        width: clean(s.width) ?? 1000, height: clean(s.height) ?? 1415,
        zIndex: clean(s.zIndex) ?? 1, rotate: clean(s.rotate) ?? 0,
        borderRadius: s.borderRadius ?? 0,
        editable: false,
        defaultImageUrl: url(`${p.pageNumber}${letter}.svg`),
      };
      if (s.shadow) out.shadow = s.shadow;
      if (s.paletteRole) out.paletteRole = s.paletteRole;
      return out;
    }),
  ];

  if (p.pageNumber > 1) imageBlocks.push({
    id: 'pagination', x: 10, y: 1376, width: 980, height: 29,
    zIndex: 50, rotate: 0, borderRadius: 0, editable: false,
    defaultImageUrl: url(`Page${p.pageNumber}.png`),
  });

  const textBlocks = p.textBlocks.map(tb => {
    const out: any = {
      id: tb.id || 'text',
      defaultText: tb.defaultText,
      x: clean(tb.x) ?? 40, y: clean(tb.y) ?? 40,
      width: clean(tb.width) ?? 920, height: clean(tb.height) ?? 70,
      fontSize: clean(tb.fontSize) ?? 24,
      fontFamily: tb.fontFamily.length === 1 ? tb.fontFamily[0] : tb.fontFamily.length > 1 ? tb.fontFamily : 'Playfair Display',
      fontWeight: tb.fontWeight || '500',
      color: clean(tb.color) ?? '#000000',
      align: tb.align, zIndex: clean(tb.zIndex) ?? 10,
      lineHeight: tb.lineHeight || '30', letterSpacing: tb.letterSpacing || '0',
      rotate: clean(tb.rotate) ?? 0, editable: true,
      type: tb.textType,
    };
    if (tb.profileField) out.profileField = tb.profileField;
    if (tb.aiHint)       out.aiHint = tb.aiHint;
    if (tb.paletteRole)  out.paletteRole = tb.paletteRole;
    if (tb.fill)         out.fill = tb.fill;
    if (tb.shadow)       out.shadow = tb.shadow;
    return out;
  });

  const out: any = { _variants: p.totalVariants, imageBlocks, textBlocks };
  if (p.background) out.background = p.background;
  if (p.colourGroups.length) out.paletteGroup = Object.fromEntries(p.colourGroups.map(g => [g.id, g.colors]));
  return out;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PageBuilder() {
  const location   = useLocation();
  const foundation = (location.state as any)?.foundation;

  const [pageNumber,     setPageNumber]     = useState(1);
  const [totalVariants,  setTotalVariants]  = useState(2);
  const [baseUrl,        setBaseUrl]        = useState('');
  const [background,     setBackground]     = useState<any>(null);
  const [showResolved,   setShowResolved]   = useState(false);
  const [resolvedV,      setResolvedV]      = useState(0);
  const [photoSlots,     setPhotoSlots]     = useState<SlotDef[]>([newSlot(0, true)]);
  const [svgSlots,       setSvgSlots]       = useState<SlotDef[]>([]);
  const [textBlocks,     setTextBlocks]     = useState<TextBlockDef[]>([newText()]);
  const [colourGroups,   setColourGroups]   = useState<ColourGroup[]>([]);

  const found = foundation?.pages?.find((p: any) => p.pageNumber === pageNumber);

  const layout = useMemo(() => buildLayout({
    pageNumber, totalVariants, photoSlots, svgSlots, textBlocks, baseUrl, colourGroups, background,
  }), [pageNumber, totalVariants, photoSlots, svgSlots, textBlocks, baseUrl, colourGroups, background]);

  const resolvedLayout = useMemo(() => {
    if (!showResolved) return null;
    const v = resolvedV % totalVariants;
    const pick = (val: any) => Array.isArray(val) ? val[v % val.length] : val;
    return {
      ...layout,
      background: pick(layout.background),
      imageBlocks: layout.imageBlocks.map((b: any) => Object.fromEntries(Object.entries(b).map(([k, val]) => [k, pick(val)]))),
      textBlocks:  layout.textBlocks.map((b: any) => Object.fromEntries(Object.entries(b).map(([k, val]) => [k, pick(val)]))),
    };
  }, [showResolved, resolvedV, layout, totalVariants]);

  const jsonText     = useMemo(() => JSON.stringify(layout, null, 2), [layout]);
  const resolvedJson = useMemo(() => resolvedLayout ? JSON.stringify(resolvedLayout, null, 2) : '', [resolvedLayout]);

  return (
    <div className={D.page}>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-5">
          <p className="text-[10px] text-gold uppercase tracking-widest mb-0.5">Studio</p>
          <h1 className="text-xl font-semibold">Page Builder</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Arrays = variant options picked by index v. Single value = same for all variants.</p>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-3">

            {/* Foundation hint */}
            {found && (
              <div className="rounded-xl border border-gold/20 bg-gold/5 p-3 space-y-0.5">
                <p className="text-[10px] font-bold text-gold uppercase">{found.title}</p>
                <p className="text-xs text-muted-foreground">{found.direction}</p>
              </div>
            )}

            {/* Page config */}
            <div className={D.card}>
              <p className={D.sect}>Page Config</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={D.label + ' block mb-1'}>Page #</label>
                  <input type="number" min={1} value={pageNumber}
                    onChange={e => setPageNumber(Math.max(1, Number(e.target.value)))} className={D.input} />
                </div>
                <div>
                  <label className={D.label + ' block mb-1'}>Variants</label>
                  <input type="number" min={1} max={10} value={totalVariants}
                    onChange={e => setTotalVariants(Math.max(1, Number(e.target.value)))} className={D.input} />
                </div>
              </div>
              <div>
                <label className={D.label + ' block mb-1'}>Base URL</label>
                <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
                  className={D.input} placeholder="https://.../template_pages/my-template" />
              </div>
              <InlineOption label="background" value={background} onChange={setBackground} placeholder="#ffffff" width="w-28" />
            </div>

            {/* Colour groups */}
            <div className={D.card}>
              <p className={D.sect}>Colour Groups</p>
              <p className="text-[11px] text-muted-foreground">Palette options the user picks from. Stored as <code className="text-gold text-[10px]">paletteGroup</code> in JSON.</p>
              <ColourGroups groups={colourGroups} onChange={setColourGroups} />
            </div>

            {/* Photo slots */}
            <div className={D.card}>
              <div className="flex items-center justify-between">
                <p className={D.sect}>Photo Slots ({photoSlots.length})</p>
                <button type="button" onClick={() => setPhotoSlots(p => [...p, newSlot(p.length, true)])}
                  className="flex items-center gap-1 text-[11px] text-gold hover:opacity-80">
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              <div className="space-y-1.5">
                {photoSlots.map((s, i) => (
                  <div key={i} className="relative">
                    <SlotRow slot={s} idx={i} label="Photo"
                      onChange={v => setPhotoSlots(p => p.map((x, idx) => idx === i ? v : x))} />
                    {photoSlots.length > 1 && (
                      <button type="button" onClick={() => setPhotoSlots(p => p.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center">×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* SVG slots */}
            <div className={D.card}>
              <div className="flex items-center justify-between">
                <p className={D.sect}>SVG Elements ({svgSlots.length})</p>
                <button type="button" onClick={() => setSvgSlots(p => [...p, newSlot(p.length, false)])}
                  className="flex items-center gap-1 text-[11px] text-gold hover:opacity-80">
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              <div className="space-y-1.5">
                {svgSlots.map((s, i) => (
                  <div key={i} className="relative">
                    <SlotRow slot={s} idx={i} label="SVG"
                      onChange={v => setSvgSlots(p => p.map((x, idx) => idx === i ? v : x))} />
                    <button type="button" onClick={() => setSvgSlots(p => p.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center">×</button>
                  </div>
                ))}
                {!svgSlots.length && <p className="text-center text-xs text-muted-foreground py-2">Decorative SVG overlays — no mask needed here.</p>}
              </div>
            </div>

            {/* Text blocks */}
            <div className={D.card}>
              <div className="flex items-center justify-between">
                <p className={D.sect}>Text Blocks ({textBlocks.length})</p>
                <button type="button" onClick={() => setTextBlocks(p => [...p, newText()])}
                  className="flex items-center gap-1 text-[11px] text-gold hover:opacity-80">
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              <div className="space-y-1.5">
                {textBlocks.map((tb, i) => (
                  <div key={i} className="relative">
                    <TextRow tb={tb} onChange={v => setTextBlocks(p => p.map((x, idx) => idx === i ? v : x))} />
                    {textBlocks.length > 1 && (
                      <button type="button" onClick={() => setTextBlocks(p => p.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center">×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Output */}
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap items-center">
              <button type="button" onClick={() => setShowResolved(v => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Eye className="h-3.5 w-3.5" />
                {showResolved ? 'Hide resolved' : 'Preview variant'}
              </button>
              {showResolved && (
                <div className="flex items-center gap-1 rounded-lg border border-border px-2 py-1">
                  <span className="text-[10px] text-muted-foreground mr-1">v =</span>
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
              <JsonOutput text={resolvedJson} label={`Resolved — v=${resolvedV}`} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}