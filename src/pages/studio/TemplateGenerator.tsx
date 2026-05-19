// src/pages/studio/TemplateGenerator.tsx
// Internal AI-powered template generator. Calls the generate-template edge function,
// shows live page previews, supports iterative refinement, and outputs SQL for Supabase.

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Wand2, X, Plus, Copy, Check, RefreshCw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

// ── Canvas constants (must match edge function) ─────────────────────────────
const PAGE_W = 1000;
const PAGE_H = 1415;
const PREVIEW_SCALE = 0.26;

// ── Style primitives ─────────────────────────────────────────────────────────
const S = {
  page:     'min-h-screen bg-background text-foreground p-4 md:p-8',
  card:     'rounded-xl border border-border bg-card p-5',
  label:    'block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5',
  input:    'w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold transition-colors',
  textarea: 'w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold transition-colors resize-none',
  chip:     'flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-1 text-xs text-foreground',
};

// ── Types ────────────────────────────────────────────────────────────────────
interface TextBlock {
  id: string; x: number; y: number; width: number; height: number;
  defaultText?: string; fontSize?: number; fontFamily?: string;
  fontWeight?: string | number; lineHeight?: number; letterSpacing?: number;
  color?: string; align?: string; zIndex?: number; rotate?: number; editable?: boolean;
}
interface ImageBlock {
  id: string; x: number; y: number; width: number; height: number;
  zIndex?: number; borderRadius?: number; rotate?: number;
  defaultImageUrl?: string; border?: { width: number; color: string; style: string }; editable?: boolean;
}
interface LayoutJson { textBlocks: TextBlock[]; imageBlocks: ImageBlock[]; }
interface Page { page_number: number; layout_json: LayoutJson; }
interface GenerateResult { pages: Page[]; templateId: string; slug: string; sql: string; usage?: any; }

// ── Tag input ────────────────────────────────────────────────────────────────
function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const add = () => {
    const v = val.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setVal('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !val && tags.length) onChange(tags.slice(0, -1));
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 rounded-md border border-input bg-muted p-2 cursor-text focus-within:border-gold transition-colors min-h-[40px]"
      onClick={() => ref.current?.focus()}
    >
      {tags.map(t => (
        <span key={t} className={S.chip}>
          {t}
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(tags.filter(x => x !== t)); }} className="ml-0.5 text-muted-foreground hover:text-foreground">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
      />
    </div>
  );
}

// ── Page preview renderer ────────────────────────────────────────────────────
function PagePreview({ page }: { page: Page }) {
  const { textBlocks = [], imageBlocks = [] } = page.layout_json ?? {};

  return (
    <div
      style={{
        width: PAGE_W * PREVIEW_SCALE,
        height: PAGE_H * PREVIEW_SCALE,
        position: 'relative',
        overflow: 'hidden',
        background: '#fff',
        flexShrink: 0,
        borderRadius: 4,
        boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
      }}
    >
      {/* Scale container */}
      <div
        style={{
          width: PAGE_W,
          height: PAGE_H,
          transform: `scale(${PREVIEW_SCALE})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0, left: 0,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {imageBlocks.map(ib => (
          <div
            key={ib.id}
            style={{
              position: 'absolute',
              left: ib.x, top: ib.y, width: ib.width, height: ib.height,
              zIndex: ib.zIndex ?? 1,
              borderRadius: ib.borderRadius ?? 0,
              transform: ib.rotate ? `rotate(${ib.rotate}deg)` : undefined,
              overflow: 'hidden',
              background: ib.defaultImageUrl ? undefined : 'rgba(150,150,150,0.15)',
              border: ib.border ? `${ib.border.width}px ${ib.border.style} ${ib.border.color}` : undefined,
            }}
          >
            {ib.defaultImageUrl ? (
              <img
                src={ib.defaultImageUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                crossOrigin="anonymous"
              />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'rgba(120,120,120,0.12)' }} />
            )}
          </div>
        ))}

        {textBlocks.map(tb => (
          <div
            key={tb.id}
            style={{
              position: 'absolute',
              left: tb.x, top: tb.y, width: tb.width, height: tb.height,
              zIndex: tb.zIndex ?? 5,
              fontSize: tb.fontSize ?? 16,
              fontFamily: tb.fontFamily ?? 'inherit',
              fontWeight: tb.fontWeight ?? 'normal',
              lineHeight: tb.lineHeight ?? 1.3,
              letterSpacing: tb.letterSpacing ?? 0,
              color: tb.color ?? '#000',
              textAlign: (tb.align as any) ?? 'left',
              transform: tb.rotate ? `rotate(${tb.rotate}deg)` : undefined,
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {tb.defaultText ?? ''}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold/90 transition-colors"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy SQL'}
    </button>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function TemplateGenerator() {
  const { toast } = useToast();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [useCase, setUseCase] = useState('');
  const [style, setStyle] = useState('');
  const [mandatoryFields, setMandatoryFields] = useState<string[]>([]);
  const [optionalHints, setOptionalHints] = useState('');
  const [pageCount, setPageCount] = useState(4);

  // Inspiration images
  const [inspirationImages, setInspirationImages] = useState<string[]>([]);
  const inspirationRef = useRef<HTMLInputElement>(null);

  // Generation state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [previousPages, setPreviousPages] = useState<Page[] | null>(null);

  // Refinement
  const [refinement, setRefinement] = useState('');
  const [refining, setRefining] = useState(false);

  // SQL visibility
  const [showSql, setShowSql] = useState(false);

  // ── Inspiration image upload ───────────────────────────────────────────────
  const handleInspirationUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    const remaining = 3 - inspirationImages.length;
    if (remaining <= 0) { toast({ title: 'Max 3 inspiration images', variant: 'destructive' }); return; }
    const toLoad = Array.from(files).slice(0, remaining);

    toLoad.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const b64 = e.target?.result as string;
        if (b64) setInspirationImages(prev => [...prev, b64].slice(0, 3));
      };
      reader.readAsDataURL(file);
    });
  }, [inspirationImages, toast]);

  // ── Call edge function ─────────────────────────────────────────────────────
  const callEdgeFunction = useCallback(async (isRefinement = false) => {
    if (!title.trim()) { toast({ title: 'Title is required', variant: 'destructive' }); return; }

    isRefinement ? setRefining(true) : setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const fnUrl = `${supabaseUrl}/functions/v1/generate-template`;

      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        targetAudience: targetAudience.trim(),
        useCase: useCase.trim(),
        style: style.trim(),
        mandatoryTextFields: mandatoryFields,
        optionalTextHints: optionalHints.trim(),
        pageCount,
        inspirationImages: inspirationImages.slice(0, 3),
      };

      if (isRefinement && previousPages && refinement.trim()) {
        payload.refinementFeedback = refinement.trim();
        payload.previousPages = previousPages;
      }

      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? 'Generation failed');
      }

      const data: GenerateResult = await res.json();
      setResult(data);
      setPreviousPages(data.pages);
      setRefinement('');
      setShowSql(false);

      toast({ title: isRefinement ? 'Template refined!' : 'Template generated!', description: `${data.pages.length} pages ready` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefining(false);
    }
  }, [title, description, targetAudience, useCase, style, mandatoryFields, optionalHints, pageCount, inspirationImages, previousPages, refinement, toast]);

  return (
    <div className={S.page}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Template Generator</h1>
          <p className="text-sm text-muted-foreground mt-1">Describe your magazine template and let Claude design it.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left: Form ── */}
          <div className="space-y-4">

            {/* Basic info */}
            <div className={S.card + ' space-y-4'}>
              <h2 className="text-sm font-semibold">Template details</h2>

              <div>
                <label className={S.label}>Title *</label>
                <input
                  className={S.input}
                  placeholder="e.g. Urban Lifestyle Weekly"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className={S.label}>Description</label>
                <textarea
                  className={S.textarea}
                  rows={2}
                  placeholder="Briefly describe the magazine's vibe, content area, and feel…"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={S.label}>Target audience</label>
                  <input
                    className={S.input}
                    placeholder="e.g. Young professionals"
                    value={targetAudience}
                    onChange={e => setTargetAudience(e.target.value)}
                  />
                </div>
                <div>
                  <label className={S.label}>Use case</label>
                  <input
                    className={S.input}
                    placeholder="e.g. Wedding programme"
                    value={useCase}
                    onChange={e => setUseCase(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={S.label}>Style keywords</label>
                <input
                  className={S.input}
                  placeholder="e.g. bold, editorial, dark luxury, minimalist"
                  value={style}
                  onChange={e => setStyle(e.target.value)}
                />
              </div>

              <div>
                <label className={S.label}>Page count</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1} max={20}
                    value={pageCount}
                    onChange={e => setPageCount(Number(e.target.value))}
                    className="flex-1 accent-gold"
                  />
                  <span className="text-sm font-semibold w-6 text-center">{pageCount}</span>
                </div>
              </div>
            </div>

            {/* Text fields */}
            <div className={S.card + ' space-y-4'}>
              <h2 className="text-sm font-semibold">Text fields</h2>

              <div>
                <label className={S.label}>Mandatory text fields <span className="text-muted-foreground normal-case font-normal">(press Enter to add)</span></label>
                <TagInput
                  tags={mandatoryFields}
                  onChange={setMandatoryFields}
                  placeholder="e.g. Couple names, Date, Venue…"
                />
              </div>

              <div>
                <label className={S.label}>Optional hints</label>
                <textarea
                  className={S.textarea}
                  rows={2}
                  placeholder="Any extra text slots the AI could add if they fit the design…"
                  value={optionalHints}
                  onChange={e => setOptionalHints(e.target.value)}
                />
              </div>
            </div>

            {/* Inspiration images */}
            <div className={S.card + ' space-y-3'}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Inspiration images <span className="text-muted-foreground font-normal">({inspirationImages.length}/3)</span></h2>
                {inspirationImages.length < 3 && (
                  <button
                    type="button"
                    onClick={() => inspirationRef.current?.click()}
                    className="flex items-center gap-1 text-xs text-gold hover:underline"
                  >
                    <Plus size={12} /> Add
                  </button>
                )}
              </div>

              <input
                ref={inspirationRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleInspirationUpload(e.target.files)}
              />

              {inspirationImages.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {inspirationImages.map((src, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setInspirationImages(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white hover:bg-black"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inspirationRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-lg py-6 text-xs text-muted-foreground hover:border-gold hover:text-gold transition-colors"
                >
                  Upload up to 3 magazine page images as inspiration
                </button>
              )}
            </div>

            {/* Generate button */}
            <button
              type="button"
              onClick={() => callEdgeFunction(false)}
              disabled={loading || refining || !title.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold py-3 text-sm font-bold text-black hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Generating…</>
              ) : (
                <><Wand2 size={16} /> Generate template</>
              )}
            </button>
          </div>

          {/* ── Right: Preview + output ── */}
          <div className="space-y-4">
            {result ? (
              <>
                {/* Page previews */}
                <div className={S.card}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold">Preview — {result.pages.length} pages</h2>
                    <span className="text-xs text-muted-foreground">{result.slug}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center">
                    {result.pages.map(page => (
                      <div key={page.page_number} className="flex flex-col items-center gap-1">
                        <PagePreview page={page} />
                        <span className="text-[10px] text-muted-foreground">p{page.page_number}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Refinement */}
                <div className={S.card + ' space-y-3'}>
                  <h2 className="text-sm font-semibold">Refine</h2>
                  <textarea
                    className={S.textarea}
                    rows={3}
                    placeholder="Tell Claude what to change — e.g. 'Make the cover bolder, add more white space on interior pages, use a dark background on page 3'…"
                    value={refinement}
                    onChange={e => setRefinement(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => callEdgeFunction(true)}
                    disabled={refining || loading || !refinement.trim()}
                    className="flex items-center gap-1.5 rounded-lg border border-gold px-4 py-2 text-sm font-medium text-gold hover:bg-gold/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {refining ? (
                      <><Loader2 size={14} className="animate-spin" /> Refining…</>
                    ) : (
                      <><RefreshCw size={14} /> Refine</>
                    )}
                  </button>
                </div>

                {/* SQL output */}
                <div className={S.card}>
                  <button
                    type="button"
                    onClick={() => setShowSql(v => !v)}
                    className="flex w-full items-center justify-between text-sm font-semibold"
                  >
                    <span>SQL to insert into Supabase</span>
                    {showSql ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showSql && (
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-end">
                        <CopyButton text={result.sql} />
                      </div>
                      <pre className="rounded-lg bg-muted p-3 text-[10px] font-mono text-foreground/80 overflow-auto max-h-80 whitespace-pre-wrap break-all">
                        {result.sql}
                      </pre>
                      <p className="text-[10px] text-muted-foreground">
                        Copy this SQL and run it in your Supabase SQL editor to create the template and all pages.
                      </p>
                    </div>
                  )}
                </div>

                {/* Token usage */}
                {result.usage && (
                  <p className="text-[10px] text-muted-foreground text-right">
                    Tokens — input: {result.usage.input_tokens?.toLocaleString()} · output: {result.usage.output_tokens?.toLocaleString()}
                    {result.usage.cache_read_input_tokens ? ` · cached: ${result.usage.cache_read_input_tokens.toLocaleString()}` : ''}
                  </p>
                )}
              </>
            ) : (
              <div className={S.card + ' flex flex-col items-center justify-center py-16 text-center'}>
                <Wand2 size={32} className="text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Fill in the form and hit <strong>Generate template</strong> to see your AI-designed pages here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}