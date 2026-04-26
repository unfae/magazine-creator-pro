// src/pages/studio/AssetManager.tsx
// /studio/assets — bulk upload tool for main_asset_bank (model photos, masks, backgrounds, textures)
// Excel-style: add multiple rows, upload files per row, commit all at once.

import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, Check, Loader2, X, ChevronDown } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type AssetType = 'model_photo' | 'mask' | 'background' | 'texture';

// All media assets go into one 'main-assets' bucket with subfolders
const ASSET_TYPES: { value: AssetType; label: string; bucket: string; folder: string; accept: string }[] = [
  { value: 'model_photo', label: 'Model Photo', bucket: 'main-assets', folder: 'model-photos', accept: 'image/*' },
  { value: 'mask',        label: 'Mask (SVG)',  bucket: 'main-assets', folder: 'masks',        accept: 'image/svg+xml,image/*' },
  { value: 'background',  label: 'Background',  bucket: 'main-assets', folder: 'backgrounds',  accept: 'image/*' },
  { value: 'texture',     label: 'Texture',     bucket: 'main-assets', folder: 'textures',     accept: 'image/*' },
];

const TAG_SUGGESTIONS: Record<AssetType, string[]> = {
  model_photo: ['female','male','studio','outdoor','portrait','full_body','candid','editorial','action','event','dark_skin','light_skin','medium_skin'],
  mask:        ['arch','organic','circle','diagonal','split','word_mask','geometric','editorial','1A','1B','2A','2B','3A'],
  background:  ['dark','light','warm','cool','grain','texture','minimal','editorial','personal','fashion'],
  texture:     ['linen','marble','paper','noise','grain','light','dark','cream','warm'],
};

interface AssetRow {
  id:        string;
  type:      AssetType;
  name:      string;
  tags:      string[];
  file:      File | null;
  previewUrl: string | null;
  status:    'idle' | 'uploading' | 'done' | 'error';
  savedUrl:  string | null;
  tagInput:  string;
}

function newRow(type: AssetType = 'model_photo'): AssetRow {
  return {
    id:         Math.random().toString(36).slice(2),
    type, name: '', tags: [], file: null,
    previewUrl: null, status: 'idle', savedUrl: null, tagInput: '',
  };
}

// ── Tag input cell ────────────────────────────────────────────────────────────

function TagCell({ row, onChange }: { row: AssetRow; onChange: (r: AssetRow) => void }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = TAG_SUGGESTIONS[row.type] ?? [];
  const remaining   = suggestions.filter(s => !row.tags.includes(s));

  function addTag(tag: string) {
    const t = tag.trim().toLowerCase().replace(/\s+/g, '_');
    if (t && !row.tags.includes(t)) onChange({ ...row, tags: [...row.tags, t], tagInput: '' });
    else onChange({ ...row, tagInput: '' });
  }

  function removeTag(tag: string) {
    onChange({ ...row, tags: row.tags.filter(t => t !== tag) });
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 min-h-[32px] p-1 rounded border border-border bg-muted focus-within:border-gold transition-colors cursor-text"
        onClick={() => setShowSuggestions(true)}>
        {row.tags.map(t => (
          <span key={t} className="flex items-center gap-0.5 bg-background border border-border rounded px-1.5 py-0.5 text-[10px] text-foreground">
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
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={row.tags.length ? '' : 'Type tag + Enter'}
          className="flex-1 min-w-[80px] bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
        />
      </div>
      {/* Suggestions dropdown */}
      {showSuggestions && remaining.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-0.5 rounded-lg border border-border bg-card shadow-lg p-2 flex flex-wrap gap-1">
          {remaining.slice(0, 12).map(s => (
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

// ── File cell ─────────────────────────────────────────────────────────────────

function FileCell({ row, onChange }: { row: AssetRow; onChange: (r: AssetRow) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const typeConf = ASSET_TYPES.find(t => t.value === row.type)!;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    // Auto-fill name from filename if empty
    const baseName = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    // Extract filename words as tags (split on separators, lowercase, dedupe)
    const filenameTags = baseName
      .toLowerCase()
      .split(/[\s_\-\.]+/)
      .map(w => w.trim())
      .filter(w => w.length > 2 && !row.tags.includes(w));
    const mergedTags = [...new Set([...row.tags, ...filenameTags])];
    onChange({ ...row, file: f, previewUrl: url, name: row.name || baseName, tags: mergedTags });
    e.target.value = '';
  }

  return (
    <div className="flex items-center gap-1.5">
      {row.previewUrl ? (
        <div className="relative w-9 h-9 rounded overflow-hidden border border-border flex-shrink-0">
          {row.type === 'mask' ? (
            <div className="w-full h-full bg-black flex items-center justify-center">
              <img src={row.previewUrl} className="w-6 h-6 invert" />
            </div>
          ) : (
            <img src={row.previewUrl} className="w-full h-full object-cover" />
          )}
          <button type="button"
            onClick={() => onChange({ ...row, file: null, previewUrl: null })}
            className="absolute top-0 right-0 w-4 h-4 bg-black/60 text-white flex items-center justify-center text-[9px]">×</button>
        </div>
      ) : (
        <button type="button"
          onClick={() => inputRef.current?.click()}
          className="w-9 h-9 rounded border border-dashed border-border hover:border-gold flex items-center justify-center text-muted-foreground hover:text-gold transition-colors flex-shrink-0">
          <Upload className="h-3.5 w-3.5" />
        </button>
      )}

      {row.status === 'uploading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />}
      {row.status === 'done'      && <Check   className="h-3.5 w-3.5 text-green-500" />}
      {row.status === 'error'     && <X       className="h-3.5 w-3.5 text-destructive" />}

      <input ref={inputRef} type="file" accept={typeConf.accept} className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── Type select cell ──────────────────────────────────────────────────────────

function TypeCell({ value, onChange }: { value: AssetType; onChange: (v: AssetType) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as AssetType)}
      className="w-full rounded border border-input bg-muted px-1.5 py-1 text-xs text-foreground focus:outline-none focus:border-gold">
      {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
    </select>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AssetManager() {
  const [rows,    setRows]    = useState<AssetRow[]>([newRow(), newRow(), newRow()]);
  const [saving,       setSaving]       = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isDragging,     setIsDragging]     = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  function updateRow(id: string, updates: Partial<AssetRow>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }

  function addRow() {
    const lastType = rows[rows.length - 1]?.type ?? 'model_photo';
    setRows(prev => [...prev, newRow(lastType)]);
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function duplicateRow(id: string) {
    const row = rows.find(r => r.id === id);
    if (!row) return;
    setRows(prev => {
      const idx  = prev.findIndex(r => r.id === id);
      const copy = { ...newRow(row.type), tags: [...row.tags], type: row.type };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }

  // Paste from clipboard (Excel-style)
  function handlePaste(e: React.ClipboardEvent, rowId: string, field: 'name' | 'tags') {
    if (field !== 'tags') return;
    const text = e.clipboardData.getData('text');
    const tags  = text.split(/[\t,\n]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    if (tags.length > 1) {
      e.preventDefault();
      updateRow(rowId, { tags });
    }
  }

  // ── Upload all rows ──────────────────────────────────────────────────────────
  async function handleSaveAll() {
    const toSave = rows.filter(r => r.file && r.name.trim() && r.status !== 'done');
    if (!toSave.length) { toast.error('No rows ready to save — add a file and name first'); return; }

    setSaving(true);
    let successCount = 0;
    let errorCount   = 0;

    for (const row of toSave) {
      updateRow(row.id, { status: 'uploading' });

      try {
        const typeConf = ASSET_TYPES.find(t => t.value === row.type)!;
        const ext      = row.file!.name.split('.').pop();
        const safeName = row.name.trim().replace(/\s+/g, '_');
        const path     = `${typeConf.folder}/${Date.now()}_${safeName}.${ext}`;

        const { data: uploaded, error: uploadErr } = await supabase.storage
          .from(typeConf.bucket)
          .upload(path, row.file!, { cacheControl: '3600', upsert: false });

        if (uploadErr) throw uploadErr;

        const url = supabase.storage.from(typeConf.bucket).getPublicUrl(uploaded.path).data.publicUrl;

        const { error: dbErr } = await supabase.from('main_asset_bank').insert({
          type: row.type,
          name: row.name.trim(),
          url,
          tags: row.tags,
        });

        if (dbErr) throw dbErr;

        updateRow(row.id, { status: 'done', savedUrl: url });
        successCount++;
      } catch (e) {
        console.error('Asset save error:', e);
        updateRow(row.id, { status: 'error' });
        errorCount++;
      }
    }

    setSaving(false);
    if (successCount) toast.success(`${successCount} asset${successCount !== 1 ? 's' : ''} saved`);
    if (errorCount)   toast.error(`${errorCount} failed — check console`);
  }

  // ── Drag and drop ────────────────────────────────────────────────────────────
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) setIsDragging(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;

    const lastType = rows[rows.length - 1]?.type ?? 'model_photo';
    const newRows: AssetRow[] = files.map(f => {
      const url       = URL.createObjectURL(f);
      const baseName  = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      const filenameTags = baseName
        .toLowerCase()
        .split(/[\s_\-\.]+/)
        .map(w => w.trim())
        .filter(w => w.length > 2);
      return {
        ...newRow(lastType),
        file: f, previewUrl: url,
        name: baseName,
        tags: [...new Set(filenameTags)],
      };
    });

    // Replace any trailing empty rows first, then append
    setRows(prev => {
      const nonEmpty = prev.filter(r => r.file || r.name.trim());
      const empties  = prev.filter(r => !r.file && !r.name.trim());
      // Fill empty rows first
      const filled = [...newRows];
      const remaining = empties.slice(filled.length);
      return [...nonEmpty, ...empties.slice(0, filled.length).map((_, i) => filled[i]), ...newRows.slice(empties.length), ...remaining];
    });

    toast.success(`${files.length} file${files.length !== 1 ? 's' : ''} added as rows`);
  }

  const readyCount = rows.filter(r => r.file && r.name.trim() && r.status !== 'done').length;
  const doneCount  = rows.filter(r => r.status === 'done').length;

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <div className="mx-auto max-w-7xl px-4 py-8">

        {/* Clear confirmation modal */}
        {showClearModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowClearModal(false); }}>
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold text-sm">Clear all rows?</h3>
              <p className="text-xs text-muted-foreground">This will remove all unsaved rows. Rows already saved to the database will not be affected.</p>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowClearModal(false)}
                  className="px-4 py-2 text-xs rounded-lg border border-border hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={() => { setRows([newRow(), newRow(), newRow()]); setShowClearModal(false); }}
                  className="px-4 py-2 text-xs rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">
                  Clear all
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] text-gold uppercase tracking-widest mb-0.5">Studio</p>
            <h1 className="text-xl font-semibold">Asset Manager</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Media assets — model photos, masks, backgrounds, textures.
              {doneCount > 0 && <span className="text-green-500 ml-2">{doneCount} saved this session.</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowClearModal(true)}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors">
              Clear all
            </button>
            <a href="/studio/elements"
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
              Elements Bank →
            </a>
            <button type="button" onClick={handleSaveAll} disabled={saving || readyCount === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gold text-black text-xs font-semibold disabled:opacity-40 hover:bg-gold/90 transition-colors">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save {readyCount > 0 ? `${readyCount} asset${readyCount !== 1 ? 's' : ''}` : 'all'}
            </button>
          </div>
        </div>

        {/* Table — also a drop zone */}
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-xl border bg-card overflow-hidden transition-colors ${
            isDragging ? 'border-gold ring-2 ring-gold/20' : 'border-border'
          }`}>
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-gold/5 pointer-events-none">
              <p className="text-gold font-semibold text-sm">Drop images to add rows</p>
            </div>
          )}
          {/* Column headers */}
          <div className="grid grid-cols-[36px_110px_140px_1fr_80px_52px] gap-2 px-3 py-2 bg-muted/50 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <div />
            <div>Type</div>
            <div>Name</div>
            <div>Tags</div>
            <div>File</div>
            <div />
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {rows.map((row, idx) => (
              <div key={row.id}
                className={`grid grid-cols-[36px_110px_140px_1fr_80px_52px] gap-2 px-3 py-2 items-center transition-colors ${
                  row.status === 'done'  ? 'bg-green-500/5' :
                  row.status === 'error' ? 'bg-destructive/5' : 'hover:bg-muted/30'
                }`}>

                {/* Row number */}
                <div className="text-[10px] text-muted-foreground/50 font-mono text-center select-none">
                  {idx + 1}
                </div>

                {/* Type */}
                <TypeCell value={row.type}
                  onChange={v => updateRow(row.id, { type: v, tags: [] })} />

                {/* Name */}
                <input
                  value={row.name}
                  onChange={e => updateRow(row.id, { name: e.target.value })}
                  placeholder="Asset name…"
                  className="w-full rounded border border-input bg-muted px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold transition-colors"
                />

                {/* Tags */}
                <div onPaste={e => handlePaste(e, row.id, 'tags')}>
                  <TagCell row={row}
                    onChange={updated => updateRow(row.id, { tags: updated.tags, tagInput: updated.tagInput })} />
                </div>

                {/* File */}
                <FileCell row={row}
                  onChange={updated => updateRow(row.id, { file: updated.file, previewUrl: updated.previewUrl, name: updated.name || row.name })} />

                {/* Actions — duplicate then delete */}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => duplicateRow(row.id)}
                    title="Duplicate row"
                    className="text-muted-foreground/50 hover:text-gold transition-colors text-sm leading-none select-none">
                    ⧉
                  </button>
                  <div className="w-px h-3 bg-border" />
                  <button type="button" onClick={() => removeRow(row.id)}
                    title="Remove row"
                    className="text-muted-foreground/40 hover:text-destructive transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add row footer */}
          <div className="border-t border-border px-3 py-2">
            <button type="button" onClick={addRow}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gold transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add row
            </button>
          </div>
        </div>

        {/* Keyboard hints */}
        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground/60">
          <span>Drag &amp; drop images anywhere on the table to auto-create rows</span>
          <span><kbd className="font-mono bg-muted px-1 rounded">Enter</kbd> or <kbd className="font-mono bg-muted px-1 rounded">,</kbd> to add a tag</span>
          <span><kbd className="font-mono bg-muted px-1 rounded">Backspace</kbd> to remove last tag</span>
          <span>Paste comma-separated tags to fill all at once</span>
          <span>Click ⧉ to duplicate a row with same type/tags</span>
        </div>

      </div>
    </div>
  );
}