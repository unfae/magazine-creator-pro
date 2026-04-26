// src/pages/GenerateMagazinePage.tsx
// AI magazine generator — seamless UX, no visible steps.
// User describes → AI generates → preview renders live.

import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Sparkles, Upload, X, RefreshCw,
  ChevronLeft, ChevronRight, Download, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { BulkTextEdit } from '@/components/BulkTextEdit';
import html2canvas from 'html2canvas';
import {
  matchLayout, matchMask, matchModelPhoto, matchPalette, matchFontCombo,
  BUILTIN_LAYOUTS,
} from '@/lib/assetMatcher';
import { useGeneratedMagazine } from '@/hooks/useGeneratedMagazine';
import type { GeneratedPage } from '@/hooks/useGeneratedMagazine';
import { getAllowedFontsCached, ensureGoogleFontsLoaded } from '@/lib/fontLoader';
import { logTemplateExport } from '@/lib/exportLog';

// ── Constants ─────────────────────────────────────────────────────────────────

const PREVIEW_SCALE = 0.3;
const PAGE_W = 1000;
const PAGE_H = 1415;

const VIBES = [
  { id: 'elegant',    label: 'Elegant'    },
  { id: 'bold',       label: 'Bold'       },
  { id: 'minimal',    label: 'Minimal'    },
  { id: 'warm',       label: 'Warm'       },
  { id: 'editorial',  label: 'Editorial'  },
  { id: 'creative',   label: 'Creative'   },
  { id: 'playful',    label: 'Playful'    },
  { id: 'classic',    label: 'Classic'    },
];

const STATUS_MESSAGES = [
  'Understanding your brief…',
  'Generating page concepts…',
  'Matching layouts and visuals…',
  'Applying colour and typography…',
  'Writing your page content…',
  'Refining and finishing…',
];

// ── Render helpers ────────────────────────────────────────────────────────────

function resolvePageLayout(page: GeneratedPage): any {
  const layout = page.layout_json;
  if (!layout) return { textBlocks: [], imageBlocks: [] };

  // Apply font combo to all text blocks
  const fontCombo = page.fontCombo;
  const palette   = page.palette;
  const bg        = page.background ?? palette?.background ?? '#ffffff';

  const textBlocks = (layout.textBlocks ?? []).map((tb: any) => ({
    ...tb,
    fontFamily: fontCombo?.display ?? tb.fontFamily,
    color: palette
      ? (tb.id === 'headline' ? (palette.primary ?? tb.color)
        : tb.id === 'body' || tb.id === 'body2' ? (palette.secondary ?? tb.color)
        : tb.id === 'caption' ? (palette.muted ?? tb.color)
        : tb.color)
      : tb.color,
  }));

  const imageBlocks = (layout.imageBlocks ?? []).map((ib: any) => ({
    ...ib,
    mask: page.maskUrl
      ? { type: 'svg', src: page.maskUrl }
      : undefined,
  }));

  return { textBlocks, imageBlocks, background: bg };
}

// ── Page canvas renderer ──────────────────────────────────────────────────────

interface PageCanvasProps {
  page:           GeneratedPage;
  pageIndex:      number;
  onSlotClick?:   (slotId: string) => void;
  onTextChange?:  (fieldId: string, value: string) => void;
  isActive?:      boolean;
}

function PageCanvas({ page, pageIndex, onSlotClick, onTextChange, isActive }: PageCanvasProps) {
  const resolved   = resolvePageLayout(page);
  const { textBlocks, imageBlocks, background } = resolved;

  const maskStyle = (block: any): React.CSSProperties => {
    if (!block.mask?.src) return {};
    return {
      WebkitMaskImage: `url(${block.mask.src})`,
      maskImage:       `url(${block.mask.src})`,
      WebkitMaskSize:  '100% 100%',
      maskSize:        '100% 100%',
    };
  };

  return (
    <div
      id={`gen-page-${page.pageNumber}`}
      style={{
        position: 'relative', width: PAGE_W, height: PAGE_H,
        background: background ?? '#ffffff',
        transform: `scale(${PREVIEW_SCALE})`,
        transformOrigin: 'top left',
        overflow: 'hidden', flexShrink: 0,
      }}
    >
      {/* Image blocks */}
      {imageBlocks.map((ib: any) => {
        const userUrl  = page.userPhotoUrls?.[ib.id];
        const modelUrl = page.modelPhotoUrls?.[ib.id];
        const src = userUrl ?? modelUrl ?? null;

        return (
          <div
            key={ib.id}
            onClick={() => onSlotClick?.(ib.id)}
            style={{
              position: 'absolute', left: ib.x, top: ib.y,
              width: ib.width, height: ib.height,
              zIndex: ib.zIndex ?? 1,
              transform: ib.rotate ? `rotate(${ib.rotate}deg)` : undefined,
              borderRadius: typeof ib.borderRadius === 'string' ? ib.borderRadius : `${ib.borderRadius ?? 0}px`,
              overflow: 'hidden',
              cursor: onSlotClick ? 'pointer' : 'default',
              ...maskStyle(ib),
            }}
          >
            {src ? (
              <img src={src} crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                background: 'rgba(180,170,155,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {onSlotClick && (
                  <span style={{ fontSize: 20, color: 'rgba(0,0,0,0.3)', fontFamily: 'sans-serif' }}>
                    + Photo
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Text blocks */}
      {textBlocks.map((tb: any) => {
        const value = page.textValues?.[tb.id] ?? '';
        return (
          <div
            key={tb.id}
            data-text-block="true"
            contentEditable={!!onTextChange}
            suppressContentEditableWarning
            onBlur={e => onTextChange?.(tb.id, (e.currentTarget as HTMLElement).innerText)}
            style={{
              position: 'absolute', left: tb.x, top: tb.y,
              width: tb.width, height: tb.height,
              fontSize: tb.fontSize, fontFamily: tb.fontFamily,
              fontWeight: tb.fontWeight as any,
              lineHeight: tb.lineHeight ? `${tb.lineHeight}px` : undefined,
              letterSpacing: tb.letterSpacing ? `${tb.letterSpacing}px` : undefined,
              color: tb.color, textAlign: tb.align as any,
              zIndex: tb.zIndex ?? 10,
              transform: tb.rotate ? `rotate(${tb.rotate}deg)` : undefined,
              overflow: 'visible', whiteSpace: 'pre-wrap',
              outline: 'none',
            }}
          >
            {value}
          </div>
        );
      })}

      {/* Page number */}
      <div style={{
        position: 'absolute', bottom: 20, left: 0, right: 0,
        textAlign: 'center', fontSize: 18, fontFamily: 'Space Mono, monospace',
        color: 'rgba(0,0,0,0.35)', letterSpacing: 2, zIndex: 20,
      }}>
        {page.pageNumber}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GenerateMagazinePage() {
  const navigate = useNavigate();
  const {
    state, hasRestore, initSession, updatePage,
    setUserPhoto, setTextValue, applyBulkPhotos, restore, dismiss, clear,
  } = useGeneratedMagazine();

  // Form state
  const [description,    setDescription]    = useState('');
  const [magazineTitle,  setMagazineTitle]  = useState('');
  const [gender,         setGender]         = useState<'female' | 'male'>('female');
  const [pageCount,      setPageCount]      = useState(8);
  const [selectedVibes,  setSelectedVibes]  = useState<string[]>([]);

  // Generation state
  const [generating,    setGenerating]    = useState(false);
  const [statusIdx,     setStatusIdx]     = useState(0);
  const [statusTimer,   setStatusTimer]   = useState<ReturnType<typeof setInterval> | null>(null);

  // Editor state
  const [currentIdx,    setCurrentIdx]    = useState(0);
  const [activeSlot,    setActiveSlot]    = useState<{ pageNum: number; slotId: string } | null>(null);
  const [isExporting,   setIsExporting]   = useState(false);

  // Bulk upload
  const [bulkPhotos,    setBulkPhotos]    = useState<string[]>([]);
  const bulkFilesRef = useRef<File[]>([]);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const slotInputRef = useRef<HTMLInputElement>(null);

  const pages   = state?.pages ?? [];
  const hasPages = pages.length > 0;

  // ── Status ticker ───────────────────────────────────────────────────────────
  function startStatusTicker() {
    let idx = 0;
    setStatusIdx(0);
    const t = setInterval(() => {
      idx = Math.min(idx + 1, STATUS_MESSAGES.length - 1);
      setStatusIdx(idx);
    }, 4000);
    setStatusTimer(t);
    return t;
  }
  function stopTicker(t: ReturnType<typeof setInterval> | null) {
    if (t) clearInterval(t);
    setStatusTimer(null);
  }

  // ── Toggle vibe ─────────────────────────────────────────────────────────────
  function toggleVibe(id: string) {
    setSelectedVibes(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  }

  // ── Main generation ──────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!description.trim()) {
      toast.error('Tell us about the magazine first');
      return;
    }

    setGenerating(true);
    const ticker = startStatusTicker();

    try {
      // ── 1. Call generate-magazine edge function ─────────────────────────────
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('generate-magazine', {
        body: {
          description:   description.trim(),
          pageCount,
          gender,
          magazineTitle: magazineTitle.trim() || undefined,
          vibes:         selectedVibes,
        },
      });

      if (fnErr || !fnData?.magazine) {
        throw new Error(fnErr?.message ?? 'Generation failed');
      }

      const magazine = fnData.magazine;

      // ── 2. Match assets for all pages in parallel ───────────────────────────
      const recentLayoutTypes: string[] = [];
      const palette   = await matchPalette(magazine.colorDirection, selectedVibes);
      const fontCombo = await matchFontCombo(selectedVibes, magazine.fontDirection);

      // Load Google Fonts if fontCombo found
      if (fontCombo) {
        const fonts = [fontCombo.display, fontCombo.body, fontCombo.accent].filter(Boolean);
        try {
          const allowed = await getAllowedFontsCached();
          ensureGoogleFontsLoaded(fonts, new Set(allowed));
        } catch { /* non-fatal */ }
      }

      const generatedPages: GeneratedPage[] = await Promise.all(
        magazine.pages.map(async (pg: any) => {
          // Layout
          const layoutMatch = await matchLayout(pg.layoutType, selectedVibes, recentLayoutTypes);
          recentLayoutTypes.push(layoutMatch.type);

          // Override palette + font in layout_json text blocks
          const layoutJson = JSON.parse(JSON.stringify(layoutMatch.json));
          if (fontCombo) {
            (layoutJson.textBlocks ?? []).forEach((tb: any) => {
              if (tb.id === 'headline' || tb.id === 'word') tb.fontFamily = fontCombo.display;
              else if (tb.id === 'caption') tb.fontFamily = fontCombo.accent;
              else tb.fontFamily = fontCombo.body;
            });
          }

          // Mask (for pages with visual metaphor)
          const maskUrl = pg.hasVisualMetaphor && pg.metaphorKeywords?.length
            ? await matchMask(pg.metaphorKeywords, '')
            : null;

          // Model photo per image slot
          const modelPhotoUrls: Record<string, string> = {};
          const slots = layoutJson.imageBlocks ?? [];
          await Promise.all(slots.map(async (ib: any) => {
            const url = await matchModelPhoto(gender, pg.imageDescription ?? '');
            if (url) modelPhotoUrls[ib.id] = url;
          }));

          // Build text values from AI output
          const textValues: Record<string, string> = {};
          const textHints = pg.textFields ?? {};
          (layoutJson.textBlocks ?? []).forEach((tb: any) => {
            if (tb.id === 'headline')   textValues[tb.id] = pg.title ?? textHints.headline ?? '';
            else if (tb.id === 'word')  textValues[tb.id] = (pg.title ?? '').split(' ')[0]?.toUpperCase() ?? '';
            else if (tb.id === 'subheading') textValues[tb.id] = textHints.subheading ?? '';
            else if (tb.id === 'body' || tb.id === 'body2') textValues[tb.id] = textHints.body ?? '';
            else if (tb.id === 'caption') textValues[tb.id] = textHints.caption ?? '';
            else if (tb.id === 'tagline') textValues[tb.id] = magazine.tagline ?? '';
            else textValues[tb.id] = textHints[tb.id] ?? tb.defaultText ?? '';
          });

          // Background from palette or Claude hint
          const bg = palette?.background
            ?? (magazine.paletteHint?.background)
            ?? '#ffffff';

          return {
            pageNumber:      pg.pageNumber,
            title:           pg.title,
            layoutType:      layoutMatch.type,
            layout_json:     layoutJson,
            visualMetaphor:  pg.visualMetaphor ?? null,
            textValues,
            modelPhotoUrls,
            userPhotoUrls:   {},
            maskUrl,
            palette:  palette ?? (magazine.paletteHint ?? null),
            fontCombo: fontCombo,
            background: bg,
          } as GeneratedPage;
        })
      );

      // ── 3. Init session ─────────────────────────────────────────────────────
      initSession({
        magazineTitle: magazine.magazineTitle,
        tagline:       magazine.tagline,
        brief:         { description, pageCount, gender, vibes: selectedVibes },
        pages:         generatedPages,
      });

      setCurrentIdx(0);
      stopTicker(ticker);
      toast.success('Magazine generated!');
    } catch (e: any) {
      console.error(e);
      stopTicker(ticker);
      toast.error(e?.message ?? 'Generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  // ── Bulk photo upload ────────────────────────────────────────────────────────
  function handleBulkSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const urls: string[] = [];
    Array.from(files).forEach(f => {
      if (!f.type.startsWith('image/')) return;
      urls.push(URL.createObjectURL(f));
      bulkFilesRef.current.push(f);
    });
    setBulkPhotos(prev => [...prev, ...urls]);
    e.target.value = '';
  }

  async function handleBulkUpload() {
    if (!bulkFilesRef.current.length) return;
    const files = [...bulkFilesRef.current];
    const toastId = toast.loading(`Uploading 0 of ${files.length}…`);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Sign in to save photos', { id: toastId });
        return;
      }

      const publicUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = `${user.id}/generated/${Date.now()}_${i}_${file.name}`;
        const { data, error } = await supabase.storage
          .from('magazine-assets')
          .upload(path, file, { cacheControl: '3600', upsert: false });

        if (error) { console.error(error); continue; }
        const url = supabase.storage.from('magazine-assets').getPublicUrl(data.path).data.publicUrl;
        publicUrls.push(url);
        toast.loading(`Uploading ${i + 1} of ${files.length}…`, { id: toastId });
      }

      if (!publicUrls.length) { toast.error('All uploads failed', { id: toastId }); return; }

      applyBulkPhotos(publicUrls);
      setBulkPhotos([]);
      bulkFilesRef.current = [];
      toast.success(`${publicUrls.length} photo${publicUrls.length !== 1 ? 's' : ''} applied`, { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Upload failed', { id: toastId });
    }
  }

  // ── Per-slot upload ──────────────────────────────────────────────────────────
  function openSlotPicker(pageNum: number, slotId: string) {
    setActiveSlot({ pageNum, slotId });
    slotInputRef.current?.click();
  }

  async function handleSlotFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeSlot) return;

    const blobUrl = URL.createObjectURL(file);
    setUserPhoto(activeSlot.pageNum, activeSlot.slotId, blobUrl);

    // Try to upload to Supabase in background
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const path = `${user.id}/generated/${Date.now()}_${file.name}`;
        const { data } = await supabase.storage.from('magazine-assets')
          .upload(path, file, { cacheControl: '3600', upsert: false });
        if (data) {
          const url = supabase.storage.from('magazine-assets').getPublicUrl(data.path).data.publicUrl;
          setUserPhoto(activeSlot.pageNum, activeSlot.slotId, url);
        }
      }
    } catch { /* blob URL works fine as fallback */ }

    setActiveSlot(null);
    e.target.value = '';
  }

  // ── Export PDF ───────────────────────────────────────────────────────────────
  async function handleExportPDF() {
    if (!pages.length) return;
    setIsExporting(true);
    const toastId = toast.loading('Preparing PDF…');

    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [PAGE_W, PAGE_H], compress: true });

      for (let i = 0; i < pages.length; i++) {
        const el = document.getElementById(`gen-page-${pages[i].pageNumber}`);
        if (!el) continue;
        toast.loading(`Rendering page ${i + 1} of ${pages.length}…`, { id: toastId });

        const clone = el.cloneNode(true) as HTMLElement;
        clone.style.width  = `${PAGE_W}px`;
        clone.style.height = `${PAGE_H}px`;
        clone.style.transform = 'none';
        clone.style.transformOrigin = 'top left';
        clone.style.position = 'absolute';
        clone.style.left = '-99999px';
        clone.style.top  = '0';
        document.body.appendChild(clone);
        await document.fonts.ready;

        const canvas = await html2canvas(clone, {
          scale: 1, useCORS: true, allowTaint: true,
          backgroundColor: '#ffffff', imageTimeout: 30000,
          width: PAGE_W, height: PAGE_H,
        });
        document.body.removeChild(clone);

        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST');
      }

      const safe = (s: string) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`${safe(state?.magazineTitle ?? 'magazine')}.pdf`);
      toast.success('PDF downloaded!', { id: toastId });

      // Log
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await logTemplateExport({
            userId: user.id, userEmail: user.email,
            templateId: undefined, templateName: state?.magazineTitle,
            exportType: 'pdf', pageCount: pages.length,
            source: 'ai', meta: { generated: true },
          });
        }
      } catch { /* non-fatal */ }
    } catch (e) {
      console.error(e);
      toast.error('Export failed', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }

  // ── Save as template ─────────────────────────────────────────────────────────
  async function handleSaveAsTemplate() {
    if (!pages.length || !state) return;
    const toastId = toast.loading('Saving as template…');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Sign in to save', { id: toastId }); return; }

      const { data: tmpl, error } = await supabase.from('templates').insert([{
        name:             state.magazineTitle,
        description:      state.brief?.description ?? '',
        template_type:    'generated',
        is_ai_generated:  true,
        canvas_width:     PAGE_W,
        canvas_height:    PAGE_H,
        generated_from_brief: state.brief,
        is_published:     false,
      }]).select().single();

      if (error || !tmpl) throw error;

      await supabase.from('template_pages').insert(
        pages.map(p => ({
          template_id:  tmpl.id,
          page_number:  p.pageNumber,
          layout_json:  {
            ...p.layout_json,
            paletteGroup: p.palette,
          },
        }))
      );

      toast.success('Saved as template! Others can use it.', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Save failed', { id: toastId });
    }
  }

  // ── Bulk text edit data ───────────────────────────────────────────────────────
  const allTextBlocks = pages.flatMap(p =>
    (p.layout_json?.textBlocks ?? []).map((tb: any) => ({ id: tb.id, defaultText: tb.defaultText ?? tb.id }))
  );
  const uniqueTextBlocks = Array.from(new Map(allTextBlocks.map(tb => [tb.id, tb])).values());

  const currentPage = pages[currentIdx];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate('/templates')}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">
            {state?.magazineTitle ?? 'Generate Magazine'}
          </h1>
          {state?.tagline && (
            <p className="text-xs text-muted-foreground truncate">{state.tagline}</p>
          )}
        </div>
        {hasPages && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span className="ml-1.5 hidden sm:inline">PDF</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleSaveAsTemplate}>
              Save as template
            </Button>
          </div>
        )}
      </div>

      {/* Restore banner */}
      {hasRestore && !hasPages && (
        <div className="bg-gold/10 border-b border-gold/20 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm">You have an unsaved magazine from a previous session.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={restore}>Restore</Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>Dismiss</Button>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-5xl">

        {/* ── Generation form ── */}
        {!hasPages && !generating && (
          <div className="max-w-xl mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-1">Describe your magazine</h2>
              <p className="text-sm text-muted-foreground">
                Tell us what this magazine is about and we'll generate the whole thing.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">What's this magazine about?</label>
              <textarea
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. A personal magazine celebrating Amara's journey as a tech founder — her wins, the late nights, the friendships, and what Lagos means to her…"
                className="w-full rounded-lg border border-input bg-muted px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold resize-none transition-colors"
              />
            </div>

            {/* Title (optional) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Magazine title <span className="text-muted-foreground font-normal">(optional — AI will suggest one)</span>
              </label>
              <input
                value={magazineTitle}
                onChange={e => setMagazineTitle(e.target.value)}
                placeholder="e.g. Uncommon, Volume I, Made by Amara…"
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold transition-colors"
              />
            </div>

            {/* Gender + Pages */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Photos style</label>
                <div className="flex gap-2">
                  {(['female', 'male'] as const).map(g => (
                    <button key={g} type="button"
                      onClick={() => setGender(g)}
                      className={cn(
                        'flex-1 py-2 rounded-lg border text-sm capitalize transition-colors',
                        gender === g ? 'bg-gold text-black border-gold font-medium' : 'border-border text-muted-foreground hover:border-gold'
                      )}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Pages: {pageCount}</label>
                <input type="range" min={4} max={16} step={2} value={pageCount}
                  onChange={e => setPageCount(Number(e.target.value))}
                  className="w-full accent-gold" />
              </div>
            </div>

            {/* Vibes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Vibe <span className="text-muted-foreground font-normal">(optional — pick one or more)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {VIBES.map(v => (
                  <button key={v.id} type="button"
                    onClick={() => toggleVibe(v.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs border transition-colors',
                      selectedVibes.includes(v.id)
                        ? 'bg-foreground text-background border-foreground font-medium'
                        : 'border-border text-muted-foreground hover:border-foreground'
                    )}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full gap-2 py-3 text-sm"
              onClick={handleGenerate}
              disabled={!description.trim()}
            >
              <Sparkles className="h-4 w-4" />
              Generate Magazine
            </Button>
          </div>
        )}

        {/* ── Generating state ── */}
        {generating && (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-gold/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold animate-spin" />
              <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-gold" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">{STATUS_MESSAGES[statusIdx]}</p>
              <p className="text-xs text-muted-foreground">This takes about 15–25 seconds</p>
            </div>
          </div>
        )}

        {/* ── Magazine preview ── */}
        {hasPages && !generating && (
          <div className="space-y-6">

            {/* Page navigation */}
            {pages.length > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {pages.length} pages generated
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                    disabled={currentIdx === 0}
                    className="p-1.5 rounded border border-border disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm">{currentIdx + 1} / {pages.length}</span>
                  <button onClick={() => setCurrentIdx(i => Math.min(pages.length - 1, i + 1))}
                    disabled={currentIdx === pages.length - 1}
                    className="p-1.5 rounded border border-border disabled:opacity-30">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-4 lg:gap-6">

              {/* ── Canvas ── */}
              <div className="flex-1">
                {/* Scrollable strip */}
                <div className="overflow-x-auto no-scrollbar mb-4">
                  <div className="flex gap-3" style={{ width: 'max-content' }}>
                    {pages.map((pg, i) => (
                      <div key={pg.pageNumber}
                        className={cn(
                          'cursor-pointer rounded overflow-hidden ring-2 transition-all flex-shrink-0',
                          i === currentIdx ? 'ring-gold' : 'ring-transparent hover:ring-border'
                        )}
                        style={{ width: PAGE_W * PREVIEW_SCALE, height: PAGE_H * PREVIEW_SCALE }}
                        onClick={() => setCurrentIdx(i)}>
                        <PageCanvas
                          page={pg} pageIndex={i}
                          onSlotClick={slotId => openSlotPicker(pg.pageNumber, slotId)}
                          onTextChange={(fieldId, value) => setTextValue(pg.pageNumber, fieldId, value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Large view of current page */}
                {currentPage && (
                  <div className="rounded-lg overflow-hidden border"
                    style={{ width: PAGE_W * PREVIEW_SCALE * 1.6, height: PAGE_H * PREVIEW_SCALE * 1.6, position: 'relative' }}>
                    <div style={{ transform: `scale(${PREVIEW_SCALE * 1.6})`, transformOrigin: 'top left', width: PAGE_W, height: PAGE_H }}>
                      <PageCanvas
                        page={currentPage} pageIndex={currentIdx}
                        onSlotClick={slotId => openSlotPicker(currentPage.pageNumber, slotId)}
                        onTextChange={(fieldId, value) => setTextValue(currentPage.pageNumber, fieldId, value)}
                        isActive
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Side panel ── */}
              <div className="w-64 shrink-0 space-y-4">

                {/* Bulk upload */}
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-medium">Upload your photos</p>
                  <p className="text-[11px] text-muted-foreground">
                    Your photos will replace the placeholder images across all pages.
                  </p>
                  <input ref={bulkInputRef} type="file" accept="image/*" multiple
                    onChange={handleBulkSelect} className="hidden" />
                  <div
                    onClick={() => bulkInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-gold transition-colors">
                    <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">{bulkPhotos.length} selected</p>
                  </div>
                  {bulkPhotos.length > 0 && (
                    <>
                      <div className="overflow-x-auto no-scrollbar">
                        <div className="flex gap-1" style={{ width: 'max-content' }}>
                          {bulkPhotos.map((u, i) => (
                            <div key={i} className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
                              <img src={u} className="w-full h-full object-cover" />
                              <button type="button"
                                onClick={() => setBulkPhotos(p => p.filter((_, idx) => idx !== i))}
                                className="absolute top-0 right-0 w-4 h-4 bg-black/60 text-white flex items-center justify-center text-[10px]">×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button size="sm" variant="gold" className="w-full text-xs"
                        onClick={handleBulkUpload}>
                        Apply to all pages
                      </Button>
                    </>
                  )}
                </div>

                {/* Bulk text edit */}
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium mb-2">Edit text fields</p>
                  <BulkTextEdit
                    textIds={uniqueTextBlocks.map(tb => tb.id)}
                    textBlocks={uniqueTextBlocks}
                    onBulkEdit={values => {
                      pages.forEach(p => {
                        Object.entries(values).forEach(([fieldId, val]) => {
                          setTextValue(p.pageNumber, fieldId, val);
                        });
                      });
                    }}
                  />
                </div>

                {/* Regenerate */}
                <Button variant="outline" size="sm" className="w-full gap-2"
                  onClick={() => { clear(); }}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Start over
                </Button>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden inputs */}
      <input ref={slotInputRef} type="file" accept="image/*" className="hidden" onChange={handleSlotFile} />
    </div>
  );
}