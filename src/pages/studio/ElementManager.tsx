// src/pages/studio/ElementManager.tsx
// /studio/elements — bulk upload tool for element_bank
// (layouts, palettes, font combos, visual metaphors, mastheads, design elements)

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, Check, Loader2, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ElementType = 'layout' | 'palette' | 'font_combo' | 'visual_metaphor' | 'masthead' | 'design_element';

const ELEMENT_TYPES: { value: ElementType; label: string; hasFile: boolean; hasJson: boolean }[] = [
  { value: 'layout',           label: 'Layout',           hasFile: false, hasJson: true  },
  { value: 'palette',          label: 'Palette',          hasFile: false, hasJson: true  },
  { value: 'font_combo',       label: 'Font Combo',       hasFile: false, hasJson: true  },
  { value: 'visual_metaphor',  label: 'Visual Metaphor',  hasFile: false, hasJson: true  },
  { value: 'masthead',         label: 'Masthead (SVG)',   hasFile: true,  hasJson: false },
  { value: 'design_element',   label: 'Design Element',   hasFile: true,  hasJson: false },
];

const TAG_SUGGESTIONS: Record<ElementType, string[]> = {
  layout:          ['cover','full_bleed','split_left','split_right','portrait_center','text_heavy','minimal','collage','editorial','word_mask','personal','fashion','travel'],
  palette:         ['warm','cool','dark','light','earthy','vibrant','pastel','monochrome','analogous','complementary','personal','fashion','brand'],
  font_combo:      ['elegant','bold','minimal','classic','modern','playful','editorial','serif','sans','condensed'],
  visual_metaphor: ['nature','urban','feminine','growth','light','motion','celebration','journey','achievement','calm'],
  masthead:        ['page_number','volume','chapter','section','minimal','circled','lined','decorative'],
  design_element:  ['line','dot','geometric','decorative','horizontal','vertical','divider','minimal'],
};

// JSON template helpers
const JSON_TEMPLATES: Partial<Record<ElementType, object>> = {
  palette: {
    background: '#ffffff', primary: '#1A1208', secondary: '#6B4E2A',
    accent: '#C69339', text: '#1A1208', muted: '#9A8870',
  },
  font_combo: {
    display: 'Playfair Display', body: 'DM Sans', accent: 'Space Mono',
    weights: { display: '700', body: '400', accent: '400' },
  },
  visual_metaphor: {
    description: 'A concrete visual image',
    iconify_queries: ['keyword1', 'keyword2'],
    mood: 'warm',
  },
  layout: {
    _variants: 1,
    imageBlocks: [],
    textBlocks: [
      { id: 'headline', x: 40, y: 200, width: 920, height: 120, fontSize: 56,
        fontWeight: '700', fontFamily: 'Playfair Display', color: '#1A1208',
        align: 'left', zIndex: 10, lineHeight: '64', letterSpacing: '-0.5',
        rotate: 0, editable: true, type: 'required' },
    ],
  },
};

interface ElementRow {
  id:       string;
  type:     ElementType;
  name:     string;
  tags:     string[];
  tagInput: string;
  jsonText: string;
  jsonValid: boolean;
  file:     File | null;
  previewUrl: string | null;
  status:   'idle' | 'uploading' | 'done' | 'error';
}

function newRow(type: ElementType = 'palette'): ElementRow {
  const tmpl = JSON_TEMPLATES[type];
  return {
    id: Math.random().toString(36).slice(2),
    type, name: '', tags: [], tagInput: '',
    jsonText: tmpl ? JSON.stringify(tmpl, null, 2) : '',
    jsonValid: true, file: null, previewUrl: null, status: 'idle',
  };
}

// ── Tag input ─────────────────────────────────────────────────────────────────

function TagCell({ row, onChange }: { row: ElementRow; onChange: (r: ElementRow) => void }) {
  const [showSug, setShowSug] = useState(false);
  const suggestions = TAG_SUGGESTIONS[row.type] ?? [];
  const remaining   = suggestions.filter(s => !row.tags.includes(s));

  function addTag(tag: string) {
    const t = tag.trim().toLowerCase().replace(/\s+/g, '_');
    if (t && !row.tags.includes(t)) onChange({ ...row, tags: [...row.tags, t], tagInput: '' });
    else onChange({ ...row, tagInput: '' });
  }
  function removeTag(tag: string) { onChange({ ...row, tags: row.tags.filter(t => t !== tag) }); }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 min-h-[30px] p-1 rounded border border-border bg-muted focus-within:border-gold transition-colors cursor-text"
        onClick={() => setShowSug(true)}>
        {row.tags.map(t => (
          <span key={t} className="flex items-center gap-0.5 bg-background border border-border rounded px-1.5 py-0.5 text-[10px]">
            {t}
            <button type="button" onClick={e => { e.stopPropagation(); removeTag(t); }}
              className="text-muted-foreground hover:text-foreground ml-0.5">×</button>
          </span>
        ))}
        <input
          value={row.tagInput}
          onChange={e => onChange({ ...row, tagInput: e.target.value })}
          onKeyDown={e => {
            if ((e.key === 'Enter' || e.key === ',') && row.tagInput.trim()) {
              e.preventDefault(); addTag(row.tagInput);
            }
            if (e.key === 'Backspace' && !row.tagInput && row.tags.length) removeTag(row.tags[row.tags.length - 1]);
          }}
          onFocus={() => setShowSug(true)}
          onBlur={() => setTimeout(() => setShowSug(false), 150)}
          placeholder={row.tags.length ? '' : 'Type + Enter'}
          className="flex-1 min-w-[60px] bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
        />
      </div>
      {showSug && remaining.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-0.5 rounded-lg border border-border bg-card shadow-lg p-1.5 flex flex-wrap gap-1">
          {remaining.slice(0, 10).map(s => (
            <button key={s} type="button"
              onMouseDown={e => { e.preventDefault(); addTag(s); }}
              className="px-2 py-0.5 text-[10px] rounded-full border border-border bg-muted hover:border-gold hover:text-gold transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── JSON editor cell ──────────────────────────────────────────────────────────

function JsonCell({ row, onChange }: { row: ElementRow; onChange: (r: ElementRow) => void }) {
  const [expanded, setExpanded] = useState(false);

  function handleChange(val: string) {
    let valid = true;
    try { JSON.parse(val); } catch { valid = false; }
    onChange({ ...row, jsonText: val, jsonValid: valid });
  }

  function loadTemplate() {
    const tmpl = JSON_TEMPLATES[row.type];
    if (tmpl) onChange({ ...row, jsonText: JSON.stringify(tmpl, null, 2), jsonValid: true });
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setExpanded(v => !v)}
          className={`flex-1 rounded border px-2 py-1 text-[10px] text-left transition-colors ${
            row.jsonValid ? 'border-border hover:border-gold' : 'border-destructive/60 text-destructive'
          }`}>
          {row.jsonValid ? (expanded ? '▲ Collapse JSON' : '▼ Edit JSON') : '⚠ Invalid JSON'}
        </button>
        {JSON_TEMPLATES[row.type] && (
          <button type="button" onClick={loadTemplate}
            className="text-[10px] text-muted-foreground hover:text-gold transition-colors px-1">
            template
          </button>
        )}
      </div>
      {expanded && (
        <textarea
          value={row.jsonText}
          onChange={e => handleChange(e.target.value)}
          rows={8}
          spellCheck={false}
          className={`w-full rounded border px-2 py-1.5 text-[10px] font-mono bg-background focus:outline-none resize-y transition-colors ${
            row.jsonValid ? 'border-border focus:border-gold' : 'border-destructive/40'
          }`}
        />
      )}
    </div>
  );
}

// ── File cell (for SVG mastheads / design elements) ───────────────────────────

function FileCell({ row, onChange }: { row: ElementRow; onChange: (r: ElementRow) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const conf = ELEMENT_TYPES.find(t => t.value === row.type)!;
  if (!conf.hasFile) return null;

  return (
    <div className="flex items-center gap-1.5">
      {row.previewUrl ? (
        <div className="relative w-9 h-9 rounded border border-border bg-black flex items-center justify-center flex-shrink-0">
          <img src={row.previewUrl} className="w-6 h-6 invert" />
          <button type="button"
            onClick={() => onChange({ ...row, file: null, previewUrl: null })}
            className="absolute top-0 right-0 w-3.5 h-3.5 bg-black/60 text-white flex items-center justify-center text-[9px]">×</button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-9 h-9 rounded border border-dashed border-border hover:border-gold flex items-center justify-center text-muted-foreground hover:text-gold transition-colors">
          <Upload className="h-3.5 w-3.5" />
        </button>
      )}
      {row.status === 'uploading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />}
      {row.status === 'done'      && <Check   className="h-3.5 w-3.5 text-green-500" />}
      {row.status === 'error'     && <X       className="h-3.5 w-3.5 text-destructive" />}
      <input ref={inputRef} type="file" accept="image/svg+xml"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]; if (!f) return;
          const url = URL.createObjectURL(f);
          onChange({ ...row, file: f, previewUrl: url, name: row.name || f.name.replace(/\.[^.]+$/, '') });
          e.target.value = '';
        }} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ElementManager() {
  const [rows,   setRows]   = useState<ElementRow[]>([newRow('palette'), newRow('font_combo'), newRow('visual_metaphor')]);
  const [saving, setSaving] = useState(false);

  function updateRow(id: string, updates: Partial<ElementRow>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }
  function addRow() {
    const lastType = rows[rows.length - 1]?.type ?? 'palette';
    setRows(prev => [...prev, newRow(lastType)]);
  }
  function removeRow(id: string) { setRows(prev => prev.filter(r => r.id !== id)); }
  function duplicateRow(id: string) {
    const row = rows.find(r => r.id === id); if (!row) return;
    setRows(prev => {
      const idx  = prev.findIndex(r => r.id === id);
      const copy = { ...newRow(row.type), tags: [...row.tags], jsonText: row.jsonText, jsonValid: row.jsonValid };
      const next = [...prev]; next.splice(idx + 1, 0, copy); return next;
    });
  }

  async function handleSaveAll() {
    const toSave = rows.filter(r => r.name.trim() && r.status !== 'done' && (r.jsonText || r.file));
    if (!toSave.length) { toast.error('No rows ready — add a name and data/file first'); return; }

    setSaving(true);
    let ok = 0; let fail = 0;

    for (const row of toSave) {
      updateRow(row.id, { status: 'uploading' });
      try {
        const conf = ELEMENT_TYPES.find(t => t.value === row.type)!;
        let url: string | undefined;

        // Upload SVG file if present
        if (conf.hasFile && row.file) {
          const folder = row.type === 'masthead' ? 'mastheads' : 'design-elements';
          const safeName = row.name.trim().replace(/\s+/g, '_');
          const path = `${folder}/${Date.now()}_${safeName}.svg`;
          const { data: up, error: upErr } = await supabase.storage
            .from('element-assets')
            .upload(path, row.file, { contentType: 'image/svg+xml', upsert: false });
          if (upErr) throw upErr;
          url = supabase.storage.from('element-assets').getPublicUrl(up.path).data.publicUrl;
        }

        // Parse JSON data
        let data: object | undefined;
        if (row.jsonText?.trim()) {
          try { data = JSON.parse(row.jsonText); } catch { throw new Error('Invalid JSON'); }
        }

        const { error: dbErr } = await supabase.from('element_bank').insert({
          type:        row.type,
          name:        row.name.trim(),
          url:         url ?? null,
          layout_json: row.type === 'layout' ? data : null,
          data:        row.type !== 'layout' ? data : null,
          tags:        row.tags,
        });
        if (dbErr) throw dbErr;

        updateRow(row.id, { status: 'done' });
        ok++;
      } catch (e) {
        console.error(e);
        updateRow(row.id, { status: 'error' });
        fail++;
      }
    }

    setSaving(false);
    if (ok)   toast.success(`${ok} element${ok !== 1 ? 's' : ''} saved`);
    if (fail) toast.error(`${fail} failed`);
  }

  const readyCount = rows.filter(r => r.name.trim() && r.status !== 'done' && (r.jsonText || r.file)).length;
  const doneCount  = rows.filter(r => r.status === 'done').length;

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <div className="mx-auto max-w-7xl px-4 py-8">

        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] text-gold uppercase tracking-widest mb-0.5">Studio</p>
            <h1 className="text-xl font-semibold">Element Manager</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Structured elements — layouts, palettes, font combos, visual metaphors, mastheads.
              {doneCount > 0 && <span className="text-green-500 ml-2">{doneCount} saved this session.</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/studio/assets"
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Asset Bank
            </a>
            <button type="button" onClick={handleSaveAll} disabled={saving || readyCount === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gold text-black text-xs font-semibold disabled:opacity-40 hover:bg-gold/90 transition-colors">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save {readyCount > 0 ? `${readyCount}` : 'all'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-visible">
          {/* Headers */}
          <div className="grid grid-cols-[32px_130px_180px_220px_1fr_52px_32px] gap-2 px-3 py-2 bg-muted/50 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <div /><div>Type</div><div>Name</div><div>Tags</div><div>Data / JSON</div><div>SVG</div><div />
          </div>

          <div className="divide-y divide-border">
            {rows.map((row, idx) => {
              const conf = ELEMENT_TYPES.find(t => t.value === row.type)!;
              return (
                <div key={row.id}
                  className={`grid grid-cols-[32px_130px_180px_220px_1fr_52px_32px] gap-2 px-3 py-2.5 items-start transition-colors ${
                    row.status === 'done'  ? 'bg-green-500/5' :
                    row.status === 'error' ? 'bg-destructive/5' : 'hover:bg-muted/20'
                  }`}>
                  <div className="text-[10px] text-muted-foreground/50 font-mono text-center pt-1.5 select-none">{idx + 1}</div>

                  {/* Type */}
                  <select value={row.type}
                    onChange={e => {
                      const t = e.target.value as ElementType;
                      const tmpl = JSON_TEMPLATES[t];
                      setRows(prev => prev.map(r => r.id === row.id ? {
                        ...r, type: t, tags: [],
                        jsonText: tmpl ? JSON.stringify(tmpl, null, 2) : '',
                        jsonValid: true,
                      } : r));
                    }}
                    className="rounded border border-input bg-muted px-1.5 py-1 text-xs focus:outline-none focus:border-gold">
                    {ELEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>

                  {/* Name */}
                  <input value={row.name} onChange={e => updateRow(row.id, { name: e.target.value })}
                    placeholder="Element name…"
                    className="rounded border border-input bg-muted px-2 py-1 text-xs focus:outline-none focus:border-gold transition-colors" />

                  {/* Tags */}
                  <TagCell row={row}
                    onChange={u => updateRow(row.id, { tags: u.tags, tagInput: u.tagInput })} />

                  {/* JSON */}
                  {conf.hasJson ? (
                    <JsonCell row={row}
                      onChange={u => updateRow(row.id, { jsonText: u.jsonText, jsonValid: u.jsonValid })} />
                  ) : (
                    <div className="text-[11px] text-muted-foreground/50 pt-1">Upload SVG →</div>
                  )}

                  {/* File */}
                  <div className="flex items-center justify-center pt-0.5">
                    <FileCell row={row}
                      onChange={u => updateRow(row.id, { file: u.file, previewUrl: u.previewUrl, name: u.name || row.name })} />
                    {row.status === 'done' && !conf.hasFile && <Check className="h-3.5 w-3.5 text-green-500" />}
                    {row.status === 'uploading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />}
                    {row.status === 'error' && <X className="h-3.5 w-3.5 text-destructive" />}
                  </div>

                  {/* Row actions */}
                  <div className="flex flex-col gap-0.5 pt-0.5">
                    <button type="button" onClick={() => duplicateRow(row.id)} title="Duplicate"
                      className="text-[9px] text-muted-foreground/40 hover:text-gold transition-colors leading-none">⧉</button>
                    <button type="button" onClick={() => removeRow(row.id)}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border px-3 py-2">
            <button type="button" onClick={addRow}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gold transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add row
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground/60">
          <span><kbd className="font-mono bg-muted px-1 rounded">Enter</kbd> or <kbd className="font-mono bg-muted px-1 rounded">,</kbd> to add a tag</span>
          <span>Click "template" to load a starter JSON for each type</span>
          <span>Click ⧉ to duplicate a row</span>
          <span>SVG files go to <code className="bg-muted px-1 rounded">element-assets/mastheads/</code> or <code className="bg-muted px-1 rounded">element-assets/design-elements/</code></span>
        </div>
      </div>
    </div>
  );
}