// src/pages/GenerateMagazinePage.tsx

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Sparkles, Upload, X, RefreshCw,
  ChevronLeft, ChevronRight, Download, Loader2,
  LayoutGrid, AlignJustify, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import html2canvas from 'html2canvas';
import {
  matchLayout, matchMask, matchModelPhoto, matchPalette, matchFontCombo,
} from '@/lib/assetMatcher';
import { useGeneratedMagazine } from '@/hooks/useGeneratedMagazine';
import type { GeneratedPage } from '@/hooks/useGeneratedMagazine';
import { getAllowedFontsCached, ensureGoogleFontsLoaded } from '@/lib/fontLoader';
import { logTemplateExport } from '@/lib/exportLog';

// ── Constants ─────────────────────────────────────────────────────────────────

const PREVIEW_SCALE = 0.3;
const THUMB_SCALE   = 0.18;
const PAGE_W = 1000;
const PAGE_H = 1415;

const VIBES = [
  { id: 'elegant', label: 'Elegant' }, { id: 'bold', label: 'Bold' },
  { id: 'minimal', label: 'Minimal' }, { id: 'warm', label: 'Warm' },
  { id: 'editorial', label: 'Editorial' }, { id: 'creative', label: 'Creative' },
  { id: 'playful', label: 'Playful' }, { id: 'classic', label: 'Classic' },
];

const STATUS_MESSAGES = [
  'Understanding your brief…',
  'Generating page concepts and writing…',
  'Matching layouts and visuals…',
  'Applying colour and typography…',
  'Finding image masks…',
  'Refining and finishing…',
];

// Background colour pool — applied based on backgroundTone from Claude
const BG_COLORS: Record<string, string[]> = {
  light:   ['#FAFAFA', '#FAF8F5', '#F8F5F0', '#FAF6EF', '#FFF9F5', '#F5F5F0', '#FDFCF8'],
  dark:    ['#141414', '#1A1A1A', '#0E0E0E', '#1C1818', '#181C1C', '#1A1614'],
  accent:  ['#FAF0E6', '#FFF5EE', '#F0F4F8', '#F5F0FA', '#F0FAF5', '#FDF5F5'],
  default: ['#FFFFFF', '#FAFAFA', '#F8F8F8'],
};

function pickBg(tone: string, palette: any): string {
  // Use palette colours for dark/accent tones if available
  if (tone === 'dark' && palette?.dark) return palette.dark;
  if (tone === 'accent' && palette?.accent) {
    // Make accent slightly lightened for bg
    return palette.light ?? BG_COLORS.accent[Math.floor(Math.random() * BG_COLORS.accent.length)];
  }
  const pool = BG_COLORS[tone] ?? BG_COLORS.default;
  return pool[Math.floor(Math.random() * pool.length)];
}

function textColorForBg(bg: string): string {
  // Simple luminance check
  const hex = bg.replace('#', '');
  const r = parseInt(hex.slice(0,2), 16);
  const g = parseInt(hex.slice(2,4), 16);
  const b = parseInt(hex.slice(4,6), 16);
  const lum = 0.299*r + 0.587*g + 0.114*b;
  return lum > 128 ? '#1A1208' : '#F5F0E8';
}

// ── Page canvas renderer ──────────────────────────────────────────────────────

function resolvePageLayout(page: GeneratedPage): any {
  const layout    = page.layout_json;
  if (!layout) return { textBlocks: [], imageBlocks: [], background: '#fff' };

  const fontCombo = page.fontCombo;
  const palette   = page.palette;
  const bg        = page.background ?? palette?.background ?? '#ffffff';
  const fgColor   = textColorForBg(bg);

  const textBlocks = (layout.textBlocks ?? []).map((tb: any) => {
    let color = tb.color;
    if (palette) {
      if (tb.id === 'headline' || tb.id === 'word') color = palette.primary ?? fgColor;
      else if (tb.id === 'body' || tb.id === 'body2' || tb.id === 'subheading') color = palette.text ?? fgColor;
      else if (tb.id === 'caption') color = palette.muted ?? fgColor;
      else color = fgColor;
    } else {
      color = fgColor;
    }
    return {
      ...tb,
      fontFamily: tb.id === 'caption' ? (fontCombo?.accent ?? tb.fontFamily)
        : tb.id === 'headline' || tb.id === 'word' ? (fontCombo?.display ?? tb.fontFamily)
        : (fontCombo?.body ?? tb.fontFamily),
      color,
    };
  });

  const imageBlocks = (layout.imageBlocks ?? []).map((ib: any) => ({
    ...ib,
    mask: page.maskUrl ? { type: 'svg', src: page.maskUrl } : undefined,
  }));

  return { textBlocks, imageBlocks, background: bg };
}

interface PageCanvasProps {
  page:          GeneratedPage;
  scale?:        number;
  onSlotClick?:  (slotId: string) => void;
  onTextChange?: (fieldId: string, value: string) => void;
}

function PageCanvas({ page, scale = PREVIEW_SCALE, onSlotClick, onTextChange }: PageCanvasProps) {
  const resolved = resolvePageLayout(page);
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
        background, overflow: 'hidden', flexShrink: 0,
        transform: `scale(${scale})`, transformOrigin: 'top left',
      }}
    >
      {imageBlocks.map((ib: any) => {
        const src = page.userPhotoUrls?.[ib.id] ?? page.modelPhotoUrls?.[ib.id] ?? null;
        return (
          <div key={ib.id} onClick={() => onSlotClick?.(ib.id)}
            style={{
              position: 'absolute', left: ib.x, top: ib.y,
              width: ib.width, height: ib.height,
              zIndex: ib.zIndex ?? 1, overflow: 'hidden',
              transform: ib.rotate ? `rotate(${ib.rotate}deg)` : undefined,
              borderRadius: typeof ib.borderRadius === 'string' ? ib.borderRadius : `${ib.borderRadius ?? 0}px`,
              cursor: onSlotClick ? 'pointer' : 'default',
              ...maskStyle(ib),
            }}
          >
            {src
              ? <img src={src} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (
                <div style={{
                  width: '100%', height: '100%', background: 'rgba(180,170,155,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {onSlotClick && (
                    <span style={{ fontSize: 20, color: 'rgba(0,0,0,0.3)', fontFamily: 'sans-serif' }}>+ Photo</span>
                  )}
                </div>
              )
            }
          </div>
        );
      })}

      {textBlocks.map((tb: any) => {
        const value = page.textValues?.[tb.id] ?? '';
        return (
          <div key={tb.id}
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
              overflow: 'visible', whiteSpace: 'pre-wrap', outline: 'none',
            }}
          >{value}</div>
        );
      })}

      <div style={{
        position: 'absolute', bottom: 20, left: 0, right: 0,
        textAlign: 'center', fontSize: 18, fontFamily: 'Space Mono, monospace',
        color: textColorForBg(background ?? '#fff') + '55',
        letterSpacing: 2, zIndex: 20, pointerEvents: 'none',
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
  const [description,   setDescription]   = useState('');
  const [magazineTitle, setMagazineTitle] = useState('');
  const [gender,        setGender]        = useState<'female' | 'male'>('female');
  const [pageCount,     setPageCount]     = useState(8);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);

  // Generation
  const [generating,  setGenerating]  = useState(false);
  const [statusIdx,   setStatusIdx]   = useState(0);

  // Editor
  const [currentIdx,   setCurrentIdx]   = useState(0);
  const [viewMode,     setViewMode]     = useState<'thumbs' | 'scroll'>('thumbs');
  const [showCustomise, setShowCustomise] = useState(false);
  const [isExporting,  setIsExporting]  = useState(false);
  const [activeSlotInfo, setActiveSlotInfo] = useState<{ pageNum: number; slotId: string } | null>(null);

  // Bulk upload
  const [bulkPhotos,   setBulkPhotos]   = useState<string[]>([]);
  const bulkFilesRef = useRef<File[]>([]);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const slotInputRef = useRef<HTMLInputElement>(null);

  const pages    = state?.pages ?? [];
  const hasPages = pages.length > 0;

  // ── Status ticker ───────────────────────────────────────────────────────────
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  function startTicker() {
    let i = 0; setStatusIdx(0);
    tickerRef.current = setInterval(() => {
      i = Math.min(i + 1, STATUS_MESSAGES.length - 1);
      setStatusIdx(i);
    }, 4500);
  }
  function stopTicker() {
    if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
  }

  useEffect(() => () => stopTicker(), []);

  function toggleVibe(id: string) {
    setSelectedVibes(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
  }

  // ── Generate ────────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!description.trim()) { toast.error('Describe the magazine first'); return; }
    setGenerating(true);
    startTicker();

    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('generate-magazine', {
        body: { description: description.trim(), pageCount, gender, magazineTitle: magazineTitle.trim() || undefined, vibes: selectedVibes },
      });
      if (fnErr || !fnData?.magazine) throw new Error(fnErr?.message ?? 'Generation failed');

      const mag = fnData.magazine;

      // ── Asset matching — palette + fonts first ────────────────────────────
      const palette   = await matchPalette(mag.colorDirection, selectedVibes);
      const fontCombo = await matchFontCombo(selectedVibes, mag.fontDirection);

      if (fontCombo) {
        try {
          const fonts   = [fontCombo.display, fontCombo.body, fontCombo.accent].filter(Boolean);
          const allowed = await getAllowedFontsCached();
          ensureGoogleFontsLoaded(fonts, new Set(allowed));
        } catch { /* non-fatal */ }
      }

      const recentTypes: string[] = [];

      // ── Per-page matching in parallel ─────────────────────────────────────
      const generatedPages: GeneratedPage[] = await Promise.all(
        mag.pages.map(async (pg: any) => {
          // Layout
          const layoutMatch = await matchLayout(pg.layoutType, selectedVibes, recentTypes);
          recentTypes.push(layoutMatch.type);

          const layoutJson = JSON.parse(JSON.stringify(layoutMatch.json));
          if (fontCombo) {
            (layoutJson.textBlocks ?? []).forEach((tb: any) => {
              if (tb.id === 'headline' || tb.id === 'word') tb.fontFamily = fontCombo.display;
              else if (tb.id === 'caption') tb.fontFamily = fontCombo.accent;
              else tb.fontFamily = fontCombo.body;
            });
          }

          // Background — use backgroundTone from Claude + palette colours
          const bg = pickBg(pg.backgroundTone ?? 'light', {
            ...palette,
            ...(mag.paletteHint ?? {}),
          });

          // Mask — try metaphor match first, then random from bank (60% coverage)
          const shouldMask = pg.hasVisualMetaphor ||
            (pg.pageNumber > 1 && Math.random() < 0.45); // extra 45% chance for non-metaphor pages
          const maskUrl = shouldMask
            ? await matchMask(pg.metaphorKeywords?.length ? pg.metaphorKeywords : ['abstract', 'shape'], '')
            : null;

          // Model photos
          const modelPhotoUrls: Record<string, string> = {};
          await Promise.all(
            (layoutJson.imageBlocks ?? []).map(async (ib: any) => {
              const url = await matchModelPhoto(gender, pg.imageDescription ?? '');
              if (url) modelPhotoUrls[ib.id] = url;
            })
          );

          // Text values
          const textValues: Record<string, string> = {};
          const hints = pg.textFields ?? {};
          const fgColor = textColorForBg(bg);
          (layoutJson.textBlocks ?? []).forEach((tb: any) => {
            if (tb.id === 'headline')    textValues[tb.id] = pg.title ?? hints.headline ?? '';
            else if (tb.id === 'word')   textValues[tb.id] = (pg.title ?? '').split(' ')[0]?.toUpperCase() ?? '';
            else if (tb.id === 'tagline') textValues[tb.id] = mag.tagline ?? '';
            else if (hints[tb.id])       textValues[tb.id] = hints[tb.id];
            else                          textValues[tb.id] = hints.body ?? tb.defaultText ?? '';
            // Fix text colour for dark backgrounds
            if (bg && !palette) tb.color = fgColor;
          });

          return {
            pageNumber:     pg.pageNumber,
            title:          pg.title,
            layoutType:     layoutMatch.type,
            layout_json:    layoutJson,
            visualMetaphor: pg.visualMetaphor ?? null,
            textValues,
            modelPhotoUrls,
            userPhotoUrls:  {},
            maskUrl,
            palette:   palette ?? (mag.paletteHint ?? null),
            fontCombo,
            background: bg,
          } as GeneratedPage;
        })
      );

      initSession({
        magazineTitle: mag.magazineTitle,
        tagline:       mag.tagline,
        brief:         { description, pageCount, gender, vibes: selectedVibes },
        pages:         generatedPages,
      });

      setCurrentIdx(0);
      stopTicker();
      toast.success('Magazine generated!');
    } catch (e: any) {
      console.error(e);
      stopTicker();
      toast.error(e?.message ?? 'Generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  // ── Photo upload — per slot ──────────────────────────────────────────────────
  function openSlotPicker(pageNum: number, slotId: string) {
    setActiveSlotInfo({ pageNum, slotId });
    setTimeout(() => slotInputRef.current?.click(), 50);
  }

  async function handleSlotFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Capture activeSlotInfo synchronously
    const slot = activeSlotInfo;
    if (!slot) { e.target.value = ''; return; }

    // Show blob URL immediately in preview
    const blobUrl = URL.createObjectURL(file);
    setUserPhoto(slot.pageNum, slot.slotId, blobUrl);
    setActiveSlotInfo(null);
    e.target.value = '';

    // Try to upload to Supabase in background (non-blocking)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const path = `${user.id}/generated/${Date.now()}_${file.name}`;
        const { data } = await supabase.storage.from('magazine-assets')
          .upload(path, file, { cacheControl: '3600', upsert: false });
        if (data) {
          const url = supabase.storage.from('magazine-assets').getPublicUrl(data.path).data.publicUrl;
          setUserPhoto(slot.pageNum, slot.slotId, url);
        }
      }
    } catch { /* blob URL is fine as fallback */ }
  }

  // ── Bulk upload ──────────────────────────────────────────────────────────────
  function handleBulkSelect(e: React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files ?? []).forEach(f => {
      if (!f.type.startsWith('image/')) return;
      setBulkPhotos(prev => [...prev, URL.createObjectURL(f)]);
      bulkFilesRef.current.push(f);
    });
    e.target.value = '';
  }

  async function handleBulkUpload() {
    if (!bulkFilesRef.current.length) return;
    const files   = [...bulkFilesRef.current];
    const toastId = toast.loading(`Uploading 0 of ${files.length}…`);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Sign in to save photos', { id: toastId }); return; }

      const publicUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f    = files[i];
        const path = `${user.id}/generated/${Date.now()}_${i}_${f.name}`;
        const { data, error } = await supabase.storage.from('magazine-assets')
          .upload(path, f, { cacheControl: '3600', upsert: false });
        if (error || !data) continue;
        publicUrls.push(supabase.storage.from('magazine-assets').getPublicUrl(data.path).data.publicUrl);
        toast.loading(`Uploading ${i + 1} of ${files.length}…`, { id: toastId });
      }

      if (!publicUrls.length) { toast.error('All uploads failed', { id: toastId }); return; }
      applyBulkPhotos(publicUrls);
      setBulkPhotos([]);
      bulkFilesRef.current = [];
      toast.success(`${publicUrls.length} photo${publicUrls.length !== 1 ? 's' : ''} applied`, { id: toastId });
    } catch (e) {
      toast.error('Upload failed', { id: toastId });
    }
  }

  // ── PDF export ───────────────────────────────────────────────────────────────
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
        clone.style.width = `${PAGE_W}px`; clone.style.height = `${PAGE_H}px`;
        clone.style.transform = 'none'; clone.style.position = 'absolute';
        clone.style.left = '-99999px'; clone.style.top = '0';
        document.body.appendChild(clone);
        await document.fonts.ready;

        const canvas = await html2canvas(clone, {
          scale: 1, useCORS: true, allowTaint: true,
          backgroundColor: null, imageTimeout: 30000, width: PAGE_W, height: PAGE_H,
        });
        document.body.removeChild(clone);
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST');
      }

      const safe = (s: string) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`${safe(state?.magazineTitle ?? 'magazine')}.pdf`);
      toast.success('PDF downloaded!', { id: toastId });

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await logTemplateExport({
          userId: user.id, userEmail: user.email,
          templateName: state?.magazineTitle,
          exportType: 'pdf', pageCount: pages.length,
          source: 'ai', meta: { generated: true },
        });
      } catch { /* non-fatal */ }
    } catch (e) {
      toast.error('Export failed', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }

  // ── All text blocks for bulk edit ─────────────────────────────────────────
  const uniqueTextBlocks = Array.from(
    new Map(
      pages.flatMap(p => (p.layout_json?.textBlocks ?? []).map((tb: any) => [tb.id, { id: tb.id, defaultText: tb.defaultText ?? tb.id }]))
    ).values()
  );

  const currentPage = pages[currentIdx];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button onClick={() => navigate('/templates')}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">{state?.magazineTitle ?? 'Generate Magazine'}</h1>
            {state?.tagline && <p className="text-[11px] text-muted-foreground truncate">{state.tagline}</p>}
          </div>
          {hasPages && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}
                className="h-8 text-xs px-2.5">
                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                <span className="ml-1 hidden sm:inline">PDF</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => { clear(); }}
                className="h-8 text-xs px-2.5">
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="ml-1 hidden sm:inline">New</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Restore banner ── */}
      {hasRestore && !hasPages && (
        <div className="bg-gold/10 border-b border-gold/20 px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs">You have an unsaved magazine from earlier.</p>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={restore}>Restore</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={dismiss}>Dismiss</Button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6">

        {/* ── FORM ── */}
        {!hasPages && !generating && (
          <div className="max-w-lg mx-auto space-y-5">
            <div>
              <h2 className="text-xl font-semibold mb-1">Describe your magazine</h2>
              <p className="text-sm text-muted-foreground">Tell us what this magazine is about and we'll generate the whole thing.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">What's this magazine about? <span className="text-muted-foreground font-normal">*</span></label>
              <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. A personal magazine celebrating my journey as a tech founder — my wins, late nights, friendships, and what Lagos means to me…"
                className="w-full rounded-lg border border-input bg-muted px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold resize-none" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Magazine title <span className="text-muted-foreground font-normal text-xs">(optional)</span></label>
              <input value={magazineTitle} onChange={e => setMagazineTitle(e.target.value)}
                placeholder="e.g. Uncommon, Volume I, Made by Amara…"
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Photo style</label>
                <div className="flex gap-2">
                  {(['female', 'male'] as const).map(g => (
                    <button key={g} type="button" onClick={() => setGender(g)}
                      className={cn('flex-1 py-2 rounded-lg border text-sm capitalize transition-colors',
                        gender === g ? 'bg-gold text-black border-gold font-medium' : 'border-border text-muted-foreground hover:border-gold')}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Pages: {pageCount}</label>
                <input type="range" min={4} max={64} step={2} value={pageCount}
                  onChange={e => setPageCount(Number(e.target.value))}
                  className="w-full accent-gold mt-2" />
                <p className="text-[11px] text-muted-foreground">{pageCount} pages</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Vibe <span className="text-muted-foreground font-normal text-xs">(optional)</span></label>
              <div className="flex flex-wrap gap-2">
                {VIBES.map(v => (
                  <button key={v.id} type="button" onClick={() => toggleVibe(v.id)}
                    className={cn('px-3 py-1.5 rounded-full text-xs border transition-colors',
                      selectedVibes.includes(v.id)
                        ? 'bg-foreground text-background border-foreground font-medium'
                        : 'border-border text-muted-foreground hover:border-foreground')}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full gap-2 py-3" onClick={handleGenerate} disabled={!description.trim()}>
              <Sparkles className="h-4 w-4" />
              Generate Magazine
            </Button>
          </div>
        )}

        {/* ── GENERATING ── */}
        {generating && (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-2 border-gold/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold animate-spin" />
              <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-gold" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">{STATUS_MESSAGES[statusIdx]}</p>
              <p className="text-xs text-muted-foreground">Usually takes 15–25 seconds</p>
            </div>
          </div>
        )}

        {/* ── MAGAZINE EDITOR ── */}
        {hasPages && !generating && (
          <div className="flex flex-col lg:flex-row gap-4">

            {/* ── Canvas area ── */}
            <div className="flex-1 min-w-0">

              {/* View toggle + page count */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">{pages.length} pages</p>
                <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
                  <button type="button" onClick={() => setViewMode('thumbs')}
                    className={cn('p-1.5 rounded-md transition-colors', viewMode === 'thumbs' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setViewMode('scroll')}
                    className={cn('p-1.5 rounded-md transition-colors', viewMode === 'scroll' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    <AlignJustify className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* ── View 1: Thumbnail grid + expanded below ── */}
              {viewMode === 'thumbs' && (
                <div className="space-y-4">
                  {/* Thumbnail strip */}
                  <div className="overflow-x-auto no-scrollbar">
                    <div className="flex gap-2 pb-1" style={{ width: 'max-content' }}>
                      {pages.map((pg, i) => (
                        <div key={pg.pageNumber}
                          className={cn('cursor-pointer rounded overflow-hidden ring-2 transition-all flex-shrink-0',
                            i === currentIdx ? 'ring-gold' : 'ring-transparent hover:ring-border')}
                          style={{ width: PAGE_W * THUMB_SCALE, height: PAGE_H * THUMB_SCALE }}
                          onClick={() => setCurrentIdx(i)}>
                          <PageCanvas page={pg} scale={THUMB_SCALE} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expanded view of selected page */}
                  {currentPage && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                            disabled={currentIdx === 0}
                            className="p-1 rounded border border-border disabled:opacity-30">
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="text-xs text-muted-foreground">{currentIdx + 1} / {pages.length}</span>
                          <button onClick={() => setCurrentIdx(i => Math.min(pages.length - 1, i + 1))}
                            disabled={currentIdx === pages.length - 1}
                            className="p-1 rounded border border-border disabled:opacity-30">
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground italic truncate max-w-[200px]">
                          {currentPage.title}
                        </p>
                      </div>

                      <div className="rounded-lg overflow-hidden border border-border"
                        style={{ width: PAGE_W * PREVIEW_SCALE, height: PAGE_H * PREVIEW_SCALE, position: 'relative' }}>
                        <PageCanvas page={currentPage} scale={PREVIEW_SCALE}
                          onSlotClick={slotId => openSlotPicker(currentPage.pageNumber, slotId)}
                          onTextChange={(fieldId, value) => setTextValue(currentPage.pageNumber, fieldId, value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── View 2: Horizontal scroll strip ── */}
              {viewMode === 'scroll' && (
                <div className="space-y-2">
                  <div className="overflow-x-auto no-scrollbar rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex gap-4" style={{ width: 'max-content' }}>
                      {pages.map((pg, i) => (
                        <div key={pg.pageNumber} className="flex-shrink-0 space-y-1.5">
                          <div
                            className={cn('rounded overflow-hidden ring-2 transition-all cursor-pointer',
                              i === currentIdx ? 'ring-gold' : 'ring-transparent hover:ring-border')}
                            style={{ width: PAGE_W * PREVIEW_SCALE, height: PAGE_H * PREVIEW_SCALE }}
                            onClick={() => setCurrentIdx(i)}>
                            <PageCanvas page={pg} scale={PREVIEW_SCALE}
                              onSlotClick={slotId => openSlotPicker(pg.pageNumber, slotId)}
                              onTextChange={(fieldId, value) => setTextValue(pg.pageNumber, fieldId, value)}
                            />
                          </div>
                          <p className="text-[10px] text-center text-muted-foreground truncate w-full">
                            {pg.pageNumber}. {pg.title}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Side panel ── */}
            <div className="w-full lg:w-60 shrink-0 space-y-3">

              {/* Upload photos */}
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-medium">Upload photos</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Tap any image slot in the preview, or bulk upload to fill all pages.
                </p>

                <input ref={bulkInputRef} type="file" accept="image/*" multiple
                  onChange={handleBulkSelect} className="hidden" />

                <div onClick={() => bulkInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-gold transition-colors">
                  <Upload className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-[11px] text-muted-foreground">
                    {bulkPhotos.length > 0 ? `${bulkPhotos.length} selected` : 'Select photos'}
                  </p>
                </div>

                {bulkPhotos.length > 0 && (
                  <>
                    <div className="overflow-x-auto no-scrollbar">
                      <div className="flex gap-1" style={{ width: 'max-content' }}>
                        {bulkPhotos.map((u, i) => (
                          <div key={i} className="relative w-9 h-9 rounded overflow-hidden flex-shrink-0">
                            <img src={u} className="w-full h-full object-cover" />
                            <button type="button"
                              onClick={() => setBulkPhotos(p => p.filter((_, idx) => idx !== i))}
                              className="absolute top-0 right-0 w-3.5 h-3.5 bg-black/60 text-white flex items-center justify-center text-[9px]">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" variant="gold" className="w-full text-xs h-8"
                      onClick={handleBulkUpload}>
                      Apply to all pages
                    </Button>
                  </>
                )}
              </div>

              {/* Bulk text edit — one per line */}
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-medium">Edit text</p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {uniqueTextBlocks.map(tb => (
                    <div key={tb.id} className="space-y-0.5">
                      <label className="text-[10px] text-muted-foreground capitalize block">
                        {tb.id.replace(/_/g, ' ')}
                      </label>
                      <input
                        defaultValue={currentPage?.textValues?.[tb.id] ?? ''}
                        onBlur={e => {
                          pages.forEach(p => setTextValue(p.pageNumber, tb.id, e.target.value));
                        }}
                        placeholder={tb.defaultText ?? ''}
                        className="w-full rounded border border-input bg-muted px-2 py-1 text-xs focus:outline-none focus:border-gold transition-colors"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Customise — colours, fonts */}
              <div className="rounded-lg border overflow-hidden">
                <button type="button"
                  onClick={() => setShowCustomise(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium hover:bg-muted/50 transition-colors">
                  Customise style
                  {showCustomise ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>

                {showCustomise && (
                  <div className="px-3 pb-3 space-y-3 border-t border-border">
                    <p className="text-[11px] text-muted-foreground pt-2 leading-snug">
                      Regenerate with different colours or fonts by updating the vibe below and re-generating.
                    </p>

                    {/* Vibes */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Vibe</label>
                      <div className="flex flex-wrap gap-1">
                        {VIBES.map(v => (
                          <button key={v.id} type="button" onClick={() => toggleVibe(v.id)}
                            className={cn('px-2 py-0.5 rounded-full text-[10px] border transition-colors',
                              selectedVibes.includes(v.id)
                                ? 'bg-foreground text-background border-foreground'
                                : 'border-border text-muted-foreground hover:border-foreground')}>
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Current palette preview */}
                    {currentPage?.palette && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Current palette</label>
                        <div className="flex gap-1">
                          {Object.entries(currentPage.palette).slice(0, 6).map(([key, val]) => (
                            <div key={key} title={key}
                              className="w-6 h-6 rounded-sm border border-white/20"
                              style={{ background: val as string }} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Current font */}
                    {currentPage?.fontCombo && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Fonts</label>
                        <p className="text-[11px]">{currentPage.fontCombo.display}</p>
                        <p className="text-[11px] text-muted-foreground">{currentPage.fontCombo.body}</p>
                      </div>
                    )}

                    <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1"
                      onClick={handleGenerate} disabled={generating || !description.trim()}>
                      <RefreshCw className="h-3 w-3" /> Regenerate
                    </Button>
                  </div>
                )}
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