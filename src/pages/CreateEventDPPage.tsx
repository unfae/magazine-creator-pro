// src/pages/CreateEventDPPage.tsx
// Guest-friendly DP creator — no sign-in, no draft saving, no video export.
// Images stay as blob URLs in memory. PDF + per-page image downloads work
// entirely from the DOM via html2canvas — nothing touches Supabase Storage.

import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Upload, X, Image, ArrowLeft, ChevronLeft, ChevronRight,
  Download, ImageDown, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { getAllowedFontsCached, ensureGoogleFontsLoaded } from '@/lib/fontLoader';
import { BulkTextEdit } from '@/components/BulkTextEdit';
import html2canvas from 'html2canvas';
import { logDpExport, getGuestFingerprint } from '@/lib/exportLog';

// ── Types (same as CreateMagazinePage) ────────────────────────────────────────

type TextBlock = {
  id: string; x: number; y: number; width: number; height: number;
  defaultText?: string; fontSize?: number; fontFamily?: string;
  fontWeight?: number | string; lineHeight?: number; letterSpacing?: number;
  color?: string; align?: string; zIndex?: number; rotate?: number; editable?: boolean;
};

type ImageBlock = {
  id: string; x: number; y: number; width: number; height: number;
  zIndex?: number; borderRadius?: number; rotate?: number;
  defaultImageUrl?: string;
  border?: { width?: number; color?: string; style?: string };
  editable?: boolean;
};

type TemplatePage = {
  id: string; template_id: string; page_number: number;
  page_image_url?: string;
  layout_json: { textBlocks?: TextBlock[]; imageBlocks?: ImageBlock[] };
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PREVIEW_SCALE = 0.3;
const PAGE_WIDTH    = 1000;
const PAGE_HEIGHT   = 1415;

// ── DOM → canvas helper ───────────────────────────────────────────────────────
// Captures a page element to an HTMLCanvasElement at full resolution.
// Blob URLs work fine here because they're same-origin.

async function pageToCanvas(pageEl: HTMLElement): Promise<HTMLCanvasElement> {
  const clone = pageEl.cloneNode(true) as HTMLElement;

  // Fix image slots — move <img> src to backgroundImage so html2canvas
  // captures them correctly (avoids CORS taint on some browsers)
  clone.querySelectorAll('[data-image-slot="true"]').forEach(slotEl => {
    const slot = slotEl as HTMLElement;
    const img  = slot.querySelector('img') as HTMLImageElement | null;
    if (!img?.src) return;
    slot.style.backgroundImage    = `url(${img.src})`;
    slot.style.backgroundSize     = 'cover';
    slot.style.backgroundPosition = 'center';
    slot.style.backgroundRepeat   = 'no-repeat';
    img.style.display = 'none';
  });

  // Remove UI chrome (replace buttons, etc.)
  clone.querySelectorAll('[data-ui="true"]').forEach(el => el.remove());

  // Fix text overflow for export
  clone.querySelectorAll('[data-text-block="true"]').forEach(el => {
    const t = el as HTMLElement;
    t.style.overflow      = 'visible';
    t.style.boxSizing     = 'border-box';
    t.style.paddingBottom = '3px';
  });

  // IMPORTANT: set position/transform properties individually so we
  // do NOT wipe the existing backgroundImage set on the page div above.
  clone.style.width           = `${PAGE_WIDTH}px`;
  clone.style.height          = `${PAGE_HEIGHT}px`;
  clone.style.transform       = 'none';
  clone.style.transformOrigin = 'top left';
  clone.style.position        = 'absolute';
  clone.style.left            = '-99999px';
  clone.style.top             = '0';
  clone.style.zIndex          = '-1';

  document.body.appendChild(clone);
  await document.fonts.ready;

  const canvas = await html2canvas(clone, {
    scale:           1,
    useCORS:         true,
    allowTaint:      true,   // allow cross-origin images (template BG is from Supabase)
    backgroundColor: '#ffffff',
    imageTimeout:    30000,
    width:           PAGE_WIDTH,
    height:          PAGE_HEIGHT,
  });
  document.body.removeChild(clone);
  return canvas;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CreateEventDPPage() {
  const { templateSlug } = useParams();
  const navigate = useNavigate();

  const [template,        setTemplate]        = useState<any>(null);
  const [templatePages,   setTemplatePages]   = useState<TemplatePage[]>([]);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [loadingPages,    setLoadingPages]    = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isExporting,     setIsExporting]     = useState(false);

  // Images: blob URLs only — never uploaded to Supabase
  const [userImages, setUserImages] = useState<Record<number, Record<string, string>>>({});
  const [userTexts,  setUserTexts]  = useState<Record<number, Record<string, string>>>({});

  // Photo preview strip (blob URLs for the strip only)
  const [photos,   setPhotos]   = useState<string[]>([]);
  const filesRef = useRef<File[]>([]);

  // File input refs
  const bulkInputRef  = useRef<HTMLInputElement>(null);
  const slotInputRef  = useRef<HTMLInputElement>(null);
  const activeSlotRef = useRef<{ pageNumber: number; slotId: string } | null>(null);

  const pageNumbers = templatePages.map(pg => pg.page_number);

  // ── Fetch template + pages ──────────────────────────────────────────────────
  useEffect(() => {
    if (!templateSlug) return;
    let mounted = true;

    (async () => {
      setLoadingTemplate(true);

      let tmpl: any = null;
      const { data: bySlug } = await supabase
        .from('templates')
        .select('*')
        .eq('slug', templateSlug)
        .eq('template_type', 'dp')
        .maybeSingle();

      if (bySlug) {
        tmpl = bySlug;
      } else {
        // Fallback: try by ID (legacy links), still require dp type
        const { data: byId } = await supabase
          .from('templates')
          .select('*')
          .eq('id', templateSlug)
          .eq('template_type', 'dp')
          .maybeSingle();
        if (byId?.slug && byId.slug !== templateSlug) {
          navigate(`/event/${byId.slug}`, { replace: true });
          return;
        }
        tmpl = byId;
      }

      if (!tmpl) { setLoadingTemplate(false); return; }
      if (!mounted) return;

      setTemplate(tmpl);
      setLoadingTemplate(false);

      setLoadingPages(true);
      const { data: pages } = await supabase
        .from('template_pages')
        .select('*')
        .eq('template_id', tmpl.id)
        .order('page_number', { ascending: true });

      if (!mounted) return;

      const initTexts:  Record<number, Record<string, string>> = {};
      const initImages: Record<number, Record<string, string>> = {};

      (pages || []).forEach((pg: any) => {
        initTexts[pg.page_number]  = {};
        initImages[pg.page_number] = {};
        (pg.layout_json?.textBlocks  ?? []).forEach((tb: TextBlock) => {
          initTexts[pg.page_number][tb.id] = tb.defaultText ?? '';
        });
      });

      setTemplatePages(pages || []);
      setUserTexts(initTexts);
      setUserImages(initImages);
      setLoadingPages(false);

      // Load fonts
      const allowed = await getAllowedFontsCached();
      const allowedSet = new Set(allowed.map(f => f.toLowerCase()));
      const fonts = new Set<string>();
      (pages || []).forEach((pg: any) => {
        (pg.layout_json?.textBlocks ?? []).forEach((tb: any) => {
          const f = tb.fontFamily?.trim();
          if (f && allowedSet.has(f.toLowerCase())) fonts.add(f);
        });
      });
      if (fonts.size) ensureGoogleFontsLoaded([...fonts], new Set(allowed));
    })();

    return () => { mounted = false; };
  }, [templateSlug, navigate]);

  // ── Bulk image select (blob URLs only — no upload) ──────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newUrls: string[] = [];
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      newUrls.push(url);
      filesRef.current.push(file);
    });

    setPhotos(prev => [...prev, ...newUrls]);
    e.target.value = '';
  }

  function removePhoto(i: number) {
    const next = [...photos];
    URL.revokeObjectURL(next[i]);
    next.splice(i, 1);
    filesRef.current.splice(i, 1);
    setPhotos(next);
  }

  // ── Apply blob URLs to all slots (cycling) ──────────────────────────────────
  function applyPhotosToTemplate(urls: string[]) {
    if (!urls.length) return;
    setUserImages(() => {
      const next: Record<number, Record<string, string>> = {};
      const allSlots: { pageNumber: number; slotId: string }[] = [];

      for (const pg of templatePages) {
        for (const ib of pg.layout_json?.imageBlocks ?? []) {
          if (ib.editable !== false) allSlots.push({ pageNumber: pg.page_number, slotId: ib.id });
        }
      }
      allSlots.forEach((s, i) => {
        next[s.pageNumber] ??= {};
        next[s.pageNumber][s.slotId] = urls[i % urls.length];
      });
      return next;
    });
    toast.success(`${urls.length} image${urls.length !== 1 ? 's' : ''} applied`);
    filesRef.current = [];
  }

  // ── Per-slot replace ────────────────────────────────────────────────────────
  function openSlotPicker(pageNumber: number, slotId: string) {
    activeSlotRef.current = { pageNumber, slotId };
    slotInputRef.current?.click();
  }

  function handleSlotFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const target = activeSlotRef.current;
    if (!file || !target) return;
    const url = URL.createObjectURL(file);
    setUserImages(prev => ({
      ...prev,
      [target.pageNumber]: { ...(prev[target.pageNumber] ?? {}), [target.slotId]: url },
    }));
    activeSlotRef.current = null;
    e.target.value = '';
  }

  function handleTextChange(pageNumber: number, id: string, value: string) {
    setUserTexts(prev => ({
      ...prev,
      [pageNumber]: { ...(prev[pageNumber] ?? {}), [id]: value },
    }));
  }

  // ── PDF export — pure DOM → canvas → jsPDF (no Supabase) ───────────────────
  async function handleExportPDF() {
    if (!templatePages.length) { toast.error('No pages to export'); return; }
    setIsExporting(true);
    const toastId = toast.loading('Preparing PDF…');
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [PAGE_WIDTH, PAGE_HEIGHT], compress: true });

      for (let i = 0; i < templatePages.length; i++) {
        const pg  = templatePages[i];
        const el  = document.getElementById(`dp-page-${pg.page_number}`);
        if (!el) continue;
        toast.loading(`Rendering page ${i + 1} of ${templatePages.length}…`, { id: toastId });
        const canvas = await pageToCanvas(el);
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT, undefined, 'FAST');
      }

      const safe = (s: string) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`${safe(template?.name ?? 'event-dp')}.pdf`);
      toast.success('PDF downloaded!', { id: toastId });

      // Log DP export — separate table, works for guests
      try {
        await logDpExport({
          templateId:       template?.id,
          templateName:     template?.name,
          templateSlug:     template?.slug,
          exportType:       'pdf',
          pageCount:        templatePages.length,
          guestFingerprint: getGuestFingerprint(),
          meta:             { pages: templatePages.length },
        });
      } catch { /* never block download */ }
    } catch (e) {
      console.error(e);
      toast.error('PDF export failed. Please try again.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }

  // ── Per-page image download ─────────────────────────────────────────────────
  async function handleDownloadPage(pg: TemplatePage) {
    const el = document.getElementById(`dp-page-${pg.page_number}`);
    if (!el) return;
    const toastId = toast.loading(`Preparing page ${pg.page_number}…`);
    try {
      const canvas = await pageToCanvas(el);
      const link   = document.createElement('a');
      link.href     = canvas.toDataURL('image/jpeg', 0.95);
      link.download = `${template?.name ?? 'dp'}-page-${pg.page_number}.jpg`;
      link.click();
      toast.success('Downloaded!', { id: toastId });

      // Log DP image export — separate table, works for guests
      try {
        await logDpExport({
          templateId:       template?.id,
          templateName:     template?.name,
          templateSlug:     template?.slug,
          exportType:       'images',
          pageCount:        1,
          guestFingerprint: getGuestFingerprint(),
          meta:             { page: pg.page_number },
        });
      } catch { /* never block download */ }
    } catch (e) {
      toast.error('Download failed', { id: toastId });
    }
  }

  // ── Skeleton ────────────────────────────────────────────────────────────────
  if (loadingTemplate) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl animate-pulse space-y-4">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="h-4 w-80 rounded bg-muted" />
        <div className="flex gap-4 mt-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-shrink-0 rounded-lg bg-muted"
              style={{ width: PAGE_WIDTH * PREVIEW_SCALE, height: PAGE_HEIGHT * PREVIEW_SCALE }} />
          ))}
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container mx-auto px-4 py-12 text-center space-y-4">
        <h1 className="text-2xl font-serif">Template not found</h1>
        <Button variant="outline" onClick={() => navigate('/templates')}>Back to Templates</Button>
      </div>
    );
  }

  const buildBgUrl = (slug: string, pageNum: number) => {
    const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/^https?:\/\//, '');
    return `https://${base}/storage/v1/object/public/template_pages/${slug}/${pageNum}.png`;
  };

  const textBlocksForBulk = Array.from(
    new Map(
      templatePages.flatMap(pg =>
        (pg.layout_json?.textBlocks ?? []).map(tb => [tb.id, { id: tb.id, defaultText: tb.defaultText ?? tb.id }])
      )
    ).values()
  );

  const currentPage = templatePages[currentPageIndex];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">

      {/* Back */}
      <button onClick={() => navigate('/templates')}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Templates
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-editorial-md mb-1">{template.name}</h1>
        {template.description && <p className="text-muted-foreground text-sm">{template.description}</p>}
        <p className="text-sm text-muted-foreground mt-2">
          Tap an image slot to upload your photo, personalise the text, and download your DP — no account needed.
        </p>
      </div>

      {/* Page preview strip */}
      {loadingPages ? (
        <div className="flex gap-4 mb-6 overflow-hidden">
          {[1, 2].map(i => (
            <div key={i} className="flex-shrink-0 rounded-lg bg-muted animate-pulse"
              style={{ width: PAGE_WIDTH * PREVIEW_SCALE, height: PAGE_HEIGHT * PREVIEW_SCALE }} />
          ))}
        </div>
      ) : (
        <div className="mb-6">
          {/* Navigation */}
          {templatePages.length > 1 && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                Page {currentPageIndex + 1} of {templatePages.length}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPageIndex(i => Math.max(0, i - 1))}
                  className="p-1.5 rounded border border-border disabled:opacity-40"
                  disabled={currentPageIndex === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => setCurrentPageIndex(i => Math.min(templatePages.length - 1, i + 1))}
                  className="p-1.5 rounded border border-border disabled:opacity-40"
                  disabled={currentPageIndex === templatePages.length - 1}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Scrollable pages */}
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-4" style={{ width: 'max-content' }}>
              {templatePages.map((pg, idx) => {
                const bgUrl = pg.page_image_url || buildBgUrl(template.slug, pg.page_number);

                return (
                  <div key={pg.id} className="flex-shrink-0 space-y-2">
                    {/* Canvas */}
                    <div
                      className={cn(
                        'relative cursor-pointer rounded-md overflow-hidden ring-2 transition-all',
                        idx === currentPageIndex ? 'ring-gold' : 'ring-transparent hover:ring-border'
                      )}
                      style={{ width: PAGE_WIDTH * PREVIEW_SCALE, height: PAGE_HEIGHT * PREVIEW_SCALE }}
                      onClick={() => setCurrentPageIndex(idx)}
                    >
                      {/* The actual full-size page (scaled) */}
                      <div
                        id={`dp-page-${pg.page_number}`}
                        style={{
                          position: 'relative',
                          width: PAGE_WIDTH, height: PAGE_HEIGHT,
                          backgroundImage: `url(${bgUrl})`,
                          backgroundSize: 'cover', backgroundPosition: 'center',
                          transform: `scale(${PREVIEW_SCALE})`,
                          transformOrigin: 'top left',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Image slots */}
                        {(pg.layout_json?.imageBlocks ?? []).map((ib: ImageBlock) => {
                          const src = (userImages[pg.page_number] ?? {})[ib.id] || ib.defaultImageUrl || '';
                          const isEditable = ib.editable !== false;
                          const bw = ib.border?.width;
                          const bc = ib.border?.color;
                          const bs = ib.border?.style ?? 'solid';

                          return (
                            <div
                              key={ib.id}
                              data-image-slot="true"
                              className={cn(
                                'absolute overflow-hidden flex items-center justify-center',
                                !src && isEditable && 'bg-gray-100/30',
                                !isEditable && 'pointer-events-none'
                              )}
                              style={{
                                left: ib.x, top: ib.y,
                                width: ib.width, height: ib.height,
                                zIndex: ib.zIndex ?? 1,
                                borderRadius: ib.borderRadius ? `${ib.borderRadius}px` : undefined,
                                transform: `rotate(${ib.rotate ?? 0}deg)`,
                                border: bw && bc ? `${bw}px ${bs} ${bc}` : undefined,
                              }}
                              onClick={(e) => {
                                if (!isEditable) return;
                                e.stopPropagation();
                                openSlotPicker(pg.page_number, ib.id);
                              }}
                            >
                              {src ? (
                                <img src={src} crossOrigin="anonymous"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                isEditable && (
                                  <div className="text-xs text-muted-foreground text-center p-2">
                                    Click to add photo
                                  </div>
                                )
                              )}
                              {isEditable && (
                                <button data-ui="true"
                                  onClick={e => { e.stopPropagation(); openSlotPicker(pg.page_number, ib.id); }}
                                  className="absolute right-1 top-1 w-7 h-7 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-90"
                                  style={{ pointerEvents: 'auto' }}>
                                  <Image className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {/* Text blocks */}
                        {(pg.layout_json?.textBlocks ?? []).map((tb: TextBlock) => {
                          const text = (userTexts[pg.page_number] ?? {})[tb.id] ?? tb.defaultText ?? '';
                          const isEditable = tb.editable !== false;
                          return (
                            <div
                              key={tb.id}
                              data-text-block="true"
                              contentEditable={isEditable}
                              suppressContentEditableWarning
                              onBlur={e => {
                                if (!isEditable) return;
                                handleTextChange(pg.page_number, tb.id, (e.currentTarget as HTMLElement).innerText);
                              }}
                              className={cn('absolute', !isEditable && 'select-none pointer-events-none')}
                              style={{
                                left: tb.x, top: tb.y,
                                width: tb.width, height: tb.height,
                                fontSize: tb.fontSize ?? 16,
                                color: tb.color ?? 'inherit',
                                textAlign: tb.align as any,
                                lineHeight: tb.lineHeight ? `${tb.lineHeight}px` : undefined,
                                letterSpacing: tb.letterSpacing ? `${tb.letterSpacing}px` : undefined,
                                fontWeight: tb.fontWeight ?? undefined,
                                fontFamily: tb.fontFamily ?? 'inherit',
                                zIndex: tb.zIndex ?? 2,
                                transform: `rotate(${tb.rotate ?? 0}deg)`,
                                overflow: 'visible', whiteSpace: 'pre-wrap',
                              }}
                            >
                              {text}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Per-page download button */}
                    <button
                      type="button"
                      onClick={() => handleDownloadPage(pg)}
                      disabled={isExporting}
                      className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md py-1.5 transition-colors disabled:opacity-40"
                    >
                      <ImageDown className="h-3.5 w-3.5" />
                      Download page {pg.page_number}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <Card>
        <div className="p-6 space-y-6">

          {/* Bulk image upload */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Upload your photo(s)</label>
            <p className="text-xs text-muted-foreground mb-3">
              Select one or more photos — we'll fit them into all image slots automatically.
            </p>
            <input ref={bulkInputRef} type="file" accept="image/*" multiple
              onChange={handleFileSelect} className="hidden" />
            <div onClick={() => bulkInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all',
                photos.length ? 'border-gold/40' : 'border-border hover:border-muted-foreground'
              )}>
              <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Click to select photos</p>
              <p className="text-xs text-muted-foreground mt-1">{photos.length} selected</p>
            </div>

            {/* Photo strip */}
            {photos.length > 0 && (
              <div className="overflow-x-auto no-scrollbar mt-3">
                <div className="flex gap-2" style={{ width: 'max-content' }}>
                  {photos.map((p, i) => (
                    <div key={i} className="relative rounded-md overflow-hidden flex-shrink-0 w-14 h-14 sm:w-20 sm:h-20">
                      <img src={p} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removePhoto(i)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-foreground/80 text-background flex items-center justify-center">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {photos.length > 0 && (
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => {
                  filesRef.current = []; photos.forEach(p => URL.revokeObjectURL(p)); setPhotos([]);
                }}>Clear</Button>
                <Button variant="gold" size="sm" onClick={() => applyPhotosToTemplate(photos)}
                  disabled={!photos.length}>
                  Apply to Template
                </Button>
              </div>
            )}
          </div>

          {/* Bulk text edit */}
          <div>
            <label className="block text-sm font-medium mb-2">Customise Text</label>
            <BulkTextEdit
              textIds={textBlocksForBulk.map(tb => tb.id)}
              textBlocks={textBlocksForBulk}
              onBulkEdit={values => {
                setUserTexts(prev => {
                  const next = { ...prev };
                  templatePages.forEach(pg => {
                    next[pg.page_number] = { ...(next[pg.page_number] ?? {}) };
                    Object.entries(values).forEach(([id, val]) => {
                      next[pg.page_number][id] = val;
                    });
                  });
                  return next;
                });
              }}
            />
          </div>
        </div>
      </Card>

      {/* Download bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          Tap any image slot on the preview to upload your own photo, then hit <strong>Download</strong> when you're ready.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Download as:</span>
          <Button variant="outline" size="sm" onClick={handleExportPDF}
            disabled={isExporting || !templatePages.length}>
            {isExporting
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Exporting…</>
              : <><Download className="h-3.5 w-3.5 mr-1.5" /> PDF</>
            }
          </Button>
          {templatePages.length === 1 && (
            <Button variant="outline" size="sm"
              onClick={() => currentPage && handleDownloadPage(currentPage)}
              disabled={isExporting}>
              <ImageDown className="h-3.5 w-3.5 mr-1.5" /> Download
            </Button>
          )}
        </div>
      </div>

      {/* Hidden slot input */}
      <input ref={slotInputRef} type="file" accept="image/*"
        className="hidden" onChange={handleSlotFileSelect} />
    </div>
  );
}