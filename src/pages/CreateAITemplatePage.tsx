// src/pages/CreateAITemplatePage.tsx
// New page for AI-capable templates. Never touches CreateMagazinePage.tsx.
// Works as a fully functional editor even without AI features enabled.
// AI features (text generation, bg removal, vibes) layer on top progressively.

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Download, Sparkles, ChevronLeft, ChevronRight,
  Upload, X, ZoomIn, ZoomOut, Move, Tag, Wand2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useTemplateAccess } from '@/hooks/useTemplateAccess';
import { useVideoExport } from '@/hooks/useVideoExport';
import { VideoExportDialog } from '@/components/VideoExportDialog';
import { BulkTextEdit } from '@/components/BulkTextEdit';
import { useProfile } from '@/hooks/useProfile';
import { useAITemplateDraft, DEFAULT_TRANSFORM } from '@/hooks/useAITemplateDraft';
import { getAllowedFontsCached, ensureGoogleFontsLoaded } from '@/lib/fontLoader';
import html2canvas from 'html2canvas';
import { logTemplateExport } from '@/lib/exportLog';
import { useTemplatePalettes, resolvePaletteColor, type TemplatePalette } from '@/hooks/useTemplatePalettes';
import { useSvgPalette } from '@/hooks/useSvgPalette';
import { resolveVariance, makeSeedString } from '@/lib/resolveVariance';
import type { VariadicPageLayout } from '@/lib/variadicTypes';
import { PaletteSelector } from '@/components/PaletteSelector';
import { useTemplateVibes, resolveVibeTypography, type TemplateVibe } from '@/hooks/useTemplateVibes';
import { VibeSelector } from '@/components/VibeSelector';

// ─── Types ────────────────────────────────────────────────────────────────────

type TextBlock = {
  id: string; x: number; y: number; width: number; height: number;
  defaultText?: string; fontSize?: number; fontFamily?: string;
  fontWeight?: number | string; lineHeight?: number; letterSpacing?: number;
  color?: string; align?: string; zIndex?: number; rotate?: number; editable?: boolean;
};

type ImageBorder = { width?: number; color?: string; style?: string; };

type ImageBlock = {
  id: string; x: number; y: number; width: number; height: number;
  zIndex?: number; borderRadius?: number; rotate?: number;
  defaultImageUrl?: string; border?: ImageBorder; editable?: boolean;
  mask?: { type: 'svg' | 'css' | 'none'; src?: string; cssValue?: string; };
  paletteRole?: string;
};

type TemplatePage = {
  id: string; template_id: string; page_number: number;
  page_image_url?: string;
  layout_json: {
    textBlocks?:      TextBlock[];
    imageBlocks?:     ImageBlock[];
    designElements?:  any[];        // DesignElement[] from variadicTypes
    paletteGroup?:    string;
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PREVIEW_SCALE = 0.3;

// ─── Image Frame (positioning + masking) ─────────────────────────────────────

interface ImageFrameProps {
  block: ImageBlock;
  src: string | null;
  transform: { scale: number; offsetX: number; offsetY: number };
  onTransformChange: (t: { scale: number; offsetX: number; offsetY: number }) => void;
  isEditMode: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

function ImageFrame({
  block, src, transform, onTransformChange, isEditMode, canvasWidth, canvasHeight,
}: ImageFrameProps) {
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  const maskStyle: React.CSSProperties = {};
  if (block.mask && block.mask.type !== 'none') {
    if (block.mask.type === 'svg' && block.mask.src) {
      maskStyle.WebkitMaskImage = `url(${block.mask.src})`;
      maskStyle.maskImage = `url(${block.mask.src})`;
      maskStyle.WebkitMaskSize = '100% 100%';
      maskStyle.maskSize = '100% 100%';
    } else if (block.mask.type === 'css' && block.mask.cssValue) {
      maskStyle.WebkitMaskImage = block.mask.cssValue;
      maskStyle.maskImage = block.mask.cssValue;
    }
  }

  function onMouseDown(e: React.MouseEvent) {
    if (!isEditMode) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: transform.offsetX, oy: transform.offsetY };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startX) / PREVIEW_SCALE;
    const dy = (e.clientY - dragRef.current.startY) / PREVIEW_SCALE;
    onTransformChange({ ...transform, offsetX: dragRef.current.ox + dx, offsetY: dragRef.current.oy + dy });
  }

  function onMouseUp() {
    dragRef.current = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: block.x, top: block.y,
        width: block.width, height: block.height,
        zIndex: block.zIndex ?? 1,
        transform: block.rotate ? `rotate(${block.rotate}deg)` : undefined,
        borderRadius: block.borderRadius ?? 0,
        overflow: 'hidden',
        cursor: isEditMode ? 'grab' : 'default',
        ...(block.border?.width ? {
          border: `${block.border.width}px ${block.border.style ?? 'solid'} ${block.border.color ?? 'transparent'}`
        } : {}),
        ...maskStyle,
      }}
      onMouseDown={onMouseDown}
    >
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: `scale(${transform.scale}) translate(${transform.offsetX / block.width * 100}%, ${transform.offsetY / block.height * 100}%)`,
            transformOrigin: 'center center',
            userSelect: 'none',
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted/40">
          <Upload className="h-6 w-6 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CreateAITemplatePage() {
  const { templateSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Template data
  const [template, setTemplate] = useState<any | null>(null);
  const [templatePages, setTemplatePages] = useState<TemplatePage[]>([]);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [loadingPages, setLoadingPages] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [templateAccessKey, setTemplateAccessKey] = useState(0);
  const [videoAccessKey, setVideoAccessKey] = useState(0);

  // Variance controls
  const [varyLayout, setVaryLayout]     = useState(false);
  const [varianceSeed, setVarianceSeed] = useState(0); // increment to re-vary
  const [userId, setUserId]             = useState<string | null>(null);

  // Canvas dimensions (from template or defaults)
  const canvasWidth  = template?.canvas_width  ?? 1000;
  const canvasHeight = template?.canvas_height ?? 1415;

  // Auth + access
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [discountedToFree, setDiscountedToFree] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState('');
  const [discountSuccess, setDiscountSuccess] = useState('');
  const [finalPrice, setFinalPrice] = useState<number | undefined>(undefined);

  const templatePay = discountedToFree && template
    ? { ...template, price: 0 }
    : finalPrice !== undefined && template
    ? { ...template, price: finalPrice }
    : template;

  const { hasTemplateAccess, loading: checkingAccess, openPaywall } =
    useTemplateAccess(templatePay, templateAccessKey);

  const { exportVideo } = useVideoExport();

  // Profile + draft
  const { profile, getAutofillValues } = useProfile();
  const { draft, loadingDraft, setTextValues, setOneText, setImageTransform, setPaletteId, setVibeId } =
    useAITemplateDraft(template?.id);

  // User images per slot: { [slotId]: File | null }
  const [userImages, setUserImages] = useState<Record<string, File | null>>({});
  const [userImageUrls, setUserImageUrls] = useState<Record<string, string>>({});

  // Palettes
  const { palettes, loading: loadingPalettes } = useTemplatePalettes(template?.id);
  const activePalette: TemplatePalette | null =
    palettes.find(p => p.id === draft.paletteId) ?? null;

  // Vibes
  const { vibes, loading: loadingVibes } = useTemplateVibes(template?.id);
  const activeVibe: TemplateVibe | null =
    vibes.find(v => v.id === draft.vibeId) ?? null;

  // Which image slot is being positioned
  const [positioningSlot, setPositioningSlot] = useState<string | null>(null);

  // Bulk edit
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  // Allowed fonts
  const [allowedFonts, setAllowedFonts] = useState<Set<string>>(new Set());

  // ── Auth check ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsSignedIn(!!data.user);
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // ── Fetch template + pages ────────────────────────────────────────────────
  useEffect(() => {
    if (!templateSlug) return;

    (async () => {
      setLoadingTemplate(true);

      // Try slug first, fall back to UUID
      let { data: tmpl } = await supabase
        .from('templates')
        .select('*')
        .eq('slug', templateSlug)
        .maybeSingle();

      if (!tmpl) {
        const { data } = await supabase
          .from('templates')
          .select('*')
          .eq('id', templateSlug)
          .maybeSingle();
        tmpl = data;
        if (tmpl?.slug) navigate(`/create-ai/${tmpl.slug}`, { replace: true });
      }

      if (!tmpl) { setLoadingTemplate(false); return; }

      setTemplate(tmpl);
      setFinalPrice(tmpl.price);
      setLoadingTemplate(false);

      // Fetch pages
      setLoadingPages(true);
      const { data: pages } = await supabase
        .from('template_pages')
        .select('*')
        .eq('template_id', tmpl.id)
        .order('page_number', { ascending: true });

      if (pages?.length) {
        setTemplatePages(pages);

        // Load fonts for all pages
        const fonts = await getAllowedFontsCached();
        setAllowedFonts(fonts);
        const allFonts = new Set<string>();
        pages.forEach(pg => {
          pg.layout_json?.textBlocks?.forEach((tb: TextBlock) => {
            if (tb.fontFamily) allFonts.add(tb.fontFamily);
          });
        });
        if (allFonts.size) ensureGoogleFontsLoaded([...allFonts], fonts);
      }
      setLoadingPages(false);
    })();
  }, [templateSlug, navigate]);

  // ── Resolved pages — applies variance when varyLayout is on ────────────────
  const resolvedPages = useMemo(() => {
    return templatePages.map(pg => {
      const layout = pg.layout_json as VariadicPageLayout;
      // Only resolve if the page actually has any variance fields
      const hasVariance =
        layout?.textBlocks?.some((tb: any) => tb.xVariance || tb.yVariance || tb.rotateVariance || tb.fontFamilyOptions || tb.colorOptions) ||
        layout?.imageBlocks?.some((ib: any) => ib.xVariance || ib.yVariance || ib.rotateVariance || ib.maskGroup) ||
        layout?.designElements?.length;

      if (!hasVariance || (!varyLayout && varianceSeed === 0)) return pg;

      const resolved = resolveVariance(layout, {
        seedString: makeSeedString(userId ?? 'guest', template?.id ?? '', pg.page_number) + varianceSeed,
        templateBaseUrl: template?.baseUrl ?? '',
      });

      return { ...pg, layout_json: resolved };
    });
  }, [templatePages, varyLayout, varianceSeed, userId, template?.id]);

  // ── Pre-fill texts from profile when draft + profile are both loaded ──────
  useEffect(() => {
    if (loadingDraft || !profile || !templatePages.length) return;

    const allIds = templatePages.flatMap(
      pg => (pg.layout_json?.textBlocks ?? []).map((tb: TextBlock) => tb.id)
    );
    const autofill = getAutofillValues(allIds);

    // Only apply autofill for fields not already in the draft
    const merged: Record<string, string> = { ...autofill };
    Object.entries(draft.textValues).forEach(([k, v]) => {
      if (v) merged[k] = v; // draft wins over autofill
    });

    if (Object.keys(merged).length > Object.keys(draft.textValues).length) {
      setTextValues(merged);
    }
  }, [loadingDraft, profile, templatePages]); // eslint-disable-line

  // ── Handle ?verify= (paid template callback) ─────────────────────────────
  useEffect(() => {
    const ref = searchParams.get('verify');
    if (!ref) return;

    (async () => {
      try {
        const { data } = await supabase.functions.invoke('verify-paystack', {
          body: { reference: ref },
        });
        if (data?.ok) {
          setTemplateAccessKey(k => k + 1);
          toast.success('Payment verified! You now have full access.');
        }
      } catch { /* silent */ }
    })();
  }, []); // eslint-disable-line

  // ── Handle ?videoVerify=true (video payment callback) ────────────────────
  useEffect(() => {
    if (searchParams.get('videoVerify') !== 'true') return;
    setVideoAccessKey(k => k + 1);
    toast.success('Video export unlocked!');
  }, []); // eslint-disable-line

  // ── Image upload helpers ──────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSlotRef = useRef<string | null>(null);

  function openFilePicker(slotId: string) {
    activeSlotRef.current = slotId;
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const slotId = activeSlotRef.current;
    if (!file || !slotId) return;

    const url = URL.createObjectURL(file);
    setUserImages(prev => ({ ...prev, [slotId]: file }));
    setUserImageUrls(prev => ({ ...prev, [slotId]: url }));
    setImageTransform(slotId, { ...DEFAULT_TRANSFORM, originalUrl: url });
    e.target.value = '';
  }

  function clearSlot(slotId: string) {
    setUserImages(prev => ({ ...prev, [slotId]: null }));
    setUserImageUrls(prev => { const n = { ...prev }; delete n[slotId]; return n; });
    setImageTransform(slotId, DEFAULT_TRANSFORM);
  }

  // ── Zoom controls for positioning ─────────────────────────────────────────
  function adjustZoom(slotId: string, delta: number) {
    const t = draft.imageTransforms[slotId] ?? DEFAULT_TRANSFORM;
    const newScale = Math.max(0.5, Math.min(3, t.scale + delta));
    setImageTransform(slotId, { scale: newScale });
  }

  // ── Discount code handler ──────────────────────────────────────────────────
  async function applyDiscount() {
    if (!discountInput.trim() || !template) return;
    setDiscountLoading(true);
    setDiscountError('');
    setDiscountSuccess('');

    const code = discountInput.trim().toUpperCase();
    const { data, error } = await supabase
      .from('template_discount_codes')
      .select('*')
      .eq('code', code)
      .eq('template_id', template.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      setDiscountError('Invalid or expired discount code.');
      setDiscountLoading(false);
      return;
    }

    const orig = Number(template.price);
    let discounted = orig;
    if (data.discount_type === 'percentage') {
      discounted = orig * (1 - data.discount_value / 100);
    } else if (data.discount_type === 'fixed') {
      discounted = Math.max(0, orig - data.discount_value);
    }
    discounted = Math.round(discounted);

    if (discounted === 0) {
      setDiscountedToFree(true);
      setDiscountSuccess('100% discount applied! Template is now free.');
    } else {
      setFinalPrice(discounted);
      setDiscountCode(code);
      setDiscountSuccess(`Discount applied! New price: ₦${discounted.toLocaleString()}`);
    }
    setDiscountLoading(false);
  }

  // ── Vibe select — applies palette + saves vibe ID ──────────────────────────
  function handleVibeSelect(vibe: TemplateVibe) {
    // Toggle off if re-selecting the same vibe
    if (draft.vibeId === vibe.id) {
      setVibeId(null);
      return;
    }
    setVibeId(vibe.id);
    // Auto-apply the vibe's linked palette if it has one
    if (vibe.palette_id) {
      setPaletteId(vibe.palette_id);
    }
  }

  // ── Bulk text apply ────────────────────────────────────────────────────────
  function handleBulkApply(values: Record<string, string>) {
    setTextValues({ ...draft.textValues, ...values });
    setShowBulkEdit(false);
    toast.success('Applied to all pages');
  }

  // ── renderPageToImageUrl (for PDF + video export) ──────────────────────────
  const renderPageToImageUrl = useCallback(async (pg: TemplatePage): Promise<string | null> => {
    const el = document.getElementById(`ai-page-${pg.page_number}`);
    if (!el) return null;

    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.width  = `${canvasWidth}px`;
    clone.style.height = `${canvasHeight}px`;
    clone.style.transform = 'none';
    clone.style.position = 'fixed';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    document.body.appendChild(clone);

    try {
      const canvas = await html2canvas(clone, {
        useCORS: true, allowTaint: true, scale: 1,
        width: canvasWidth, height: canvasHeight,
        backgroundColor: null,
      });
      return new Promise(resolve => {
        canvas.toBlob(b => resolve(b ? URL.createObjectURL(b) : null), 'image/jpeg', 0.92);
      });
    } finally {
      document.body.removeChild(clone);
    }
  }, [canvasWidth, canvasHeight]);

  // ── PDF export ─────────────────────────────────────────────────────────────
  async function handleExportPDF() {
    if (!hasTemplateAccess) { openPaywall(discountCode, finalPrice); return; }

    const toastId = toast.loading('Preparing PDF…');
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvasWidth, canvasHeight] });

      for (let i = 0; i < templatePages.length; i++) {
        if (i > 0) pdf.addPage([canvasWidth, canvasHeight]);
        const url = await renderPageToImageUrl(templatePages[i]);
        if (url) pdf.addImage(url, 'JPEG', 0, 0, canvasWidth, canvasHeight, undefined, 'FAST');
        toast.loading(`Rendering page ${i + 1} of ${templatePages.length}…`, { id: toastId });
      }

      pdf.save(`${template?.name ?? 'magazine'}.pdf`);
      toast.success('PDF downloaded!', { id: toastId });

      const { data: { user } } = await supabase.auth.getUser();
      if (user) logTemplateExport({ userId: user.id, templateId: template?.id, templateName: template?.name, exportType: 'pdf', pageCount: templatePages.length });
    } catch (e) {
      toast.error('PDF export failed. Please try again.', { id: toastId });
    }
  }

  // ── Palette-aware SVG image block ────────────────────────────────────────────
  // Separate component so the useSvgPalette hook can be called per-block
  function PaletteImageBlock({ block, src, transform, isEditMode }: {
    block: ImageBlock;
    src: string | null;
    transform: { scale: number; offsetX: number; offsetY: number };
    isEditMode: boolean;
  }) {
    // If the block is a non-editable SVG overlay with a paletteRole,
    // inject palette colours into its SVG source
    const isSvgOverlay = !block.editable && block.defaultImageUrl?.endsWith('.svg');
    const paletteColors = activePalette?.colors ?? null;
    const recolouredSrc = useSvgPalette(
      isSvgOverlay ? block.defaultImageUrl : null,
      paletteColors
    );
    const resolvedSrc = isSvgOverlay ? (recolouredSrc ?? src) : src;

    return (
      <ImageFrame
        block={block}
        src={resolvedSrc}
        transform={transform}
        onTransformChange={t => setImageTransform(block.id, t)}
        isEditMode={isEditMode}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
      />
    );
  }

  // ── Render a single page canvas ────────────────────────────────────────────
  function renderPage(pg: TemplatePage) {
    // Use the resolved version of this page (variance applied if varyLayout is on)
    const resolvedPg = resolvedPages.find(r => r.page_number === pg.page_number) ?? pg;
    const { textBlocks = [], imageBlocks = [] } = resolvedPg.layout_json ?? {};
    const editableSlots = imageBlocks.filter(b => b.editable !== false);

    return (
      <div
        id={`ai-page-${pg.page_number}`}
        style={{
          position: 'relative',
          width: canvasWidth,
          height: canvasHeight,
          transform: `scale(${PREVIEW_SCALE})`,
          transformOrigin: 'top left',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Background — palette override if set */}
        <div style={{
          position: 'absolute', inset: 0,
          background: activePalette?.colors.background ?? '#fff',
        }} />

        {/* Image blocks */}
        {imageBlocks.map(block => {
          const transform = draft.imageTransforms[block.id] ?? DEFAULT_TRANSFORM;
          const isEditable = block.editable !== false;
          const src = isEditable
            ? (draft.imageTransforms[block.id]?.bgRemoved
                ? draft.imageTransforms[block.id].processedUrl
                : userImageUrls[block.id] ?? null)
            : block.defaultImageUrl ?? null;

          return (
            <ImageFrame
              key={block.id}
              block={block}
              src={src ?? block.defaultImageUrl ?? null}
              transform={transform}
              onTransformChange={t => setImageTransform(block.id, t)}
              isEditMode={positioningSlot === block.id}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
            />
          );
        })}

        {/* Design elements (lines, shapes, dots) */}
        {(pg.layout_json?.designElements ?? []).map((el: any) => (
          <div
            key={el.id}
            style={{
              position:     'absolute',
              left:         el.x,
              top:          el.y,
              width:        el.width,
              height:       el.height,
              background:   el.color,
              opacity:      el.opacity ?? 1,
              zIndex:       el.zIndex ?? 5,
              borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined,
              transform:    el.rotate ? `rotate(${el.rotate}deg)` : undefined,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Text blocks */}
        {textBlocks.map((tb, tIdx) => {
          const value = draft.textValues[tb.id] ?? tb.defaultText ?? '';
          return (
            <div
              key={tb.id}
              style={(() => {
                // Merge: base block styles < vibe typography < palette colour
                const vibeT = resolveVibeTypography(tIdx, activeVibe);
                const resolvedFontFamily    = vibeT?.fontFamily    ?? tb.fontFamily;
                const resolvedFontWeight    = vibeT?.fontWeight    ?? tb.fontWeight;
                const resolvedFontSize      = vibeT?.fontSize      ?? tb.fontSize;
                const resolvedLetterSpacing = vibeT?.letterSpacing ?? (tb.letterSpacing ? String(tb.letterSpacing) : undefined);
                const resolvedLineHeight    = vibeT?.lineHeight    ?? (tb.lineHeight    ? String(tb.lineHeight)    : undefined);
                const resolvedColor =
                  resolvePaletteColor(tb.paletteRole, activePalette) ??
                  vibeT?.color ??
                  tb.color ?? '#000';
                return {
                position: 'absolute',
                left: tb.x, top: tb.y,
                width: tb.width, height: tb.height,
                fontSize: resolvedFontSize, fontFamily: resolvedFontFamily,
                fontWeight: resolvedFontWeight as any,
                lineHeight: resolvedLineHeight ? `${resolvedLineHeight}px` : undefined,
                letterSpacing: resolvedLetterSpacing ? `${resolvedLetterSpacing}px` : undefined,
                color: resolvedColor,
                textAlign: (tb.align ?? 'left') as any,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                overflow: 'hidden',
                zIndex: tb.zIndex ?? 10,
                transform: tb.rotate ? `rotate(${tb.rotate}deg)` : undefined,
                };
              })()}
            >
              {value}
            </div>
          );
        })}
      </div>
    );
  }

  // ── All text blocks across all pages (for BulkTextEdit) ───────────────────
  // Use resolvedPages for rendering (variance applied)
  const allTextBlocks = resolvedPages.flatMap(pg => pg.layout_json?.textBlocks ?? []);
  const editableTextBlocks = allTextBlocks.filter(tb => tb.editable !== false);

  // ── Current page data ─────────────────────────────────────────────────────
  const currentPage = templatePages[currentPageIndex];
  const resolvedCurrentPage = resolvedPages[currentPageIndex];
  const editableImageBlocks = resolvedCurrentPage?.layout_json?.imageBlocks?.filter((b: any) => b.editable !== false) ?? [];

  // ── Guard: loading ────────────────────────────────────────────────────────
  if (loadingTemplate) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Template not found.</p>
        <Button variant="outline" onClick={() => navigate('/templates')}>Back to Templates</Button>
      </div>
    );
  }

  const isPaidTemplate = (template.price ?? 0) > 0;

  // ── Paywall screen ────────────────────────────────────────────────────────
  if (isPaidTemplate && !checkingAccess && !hasTemplateAccess) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
        <h2 className="text-2xl font-semibold">{template.name}</h2>
        <p className="text-muted-foreground">
          Unlock this template to customise and export your magazine.
        </p>
        <p className="text-3xl font-bold">
          ₦{Number(finalPrice ?? template.price).toLocaleString()}
        </p>

        {/* Discount code */}
        <div className="flex gap-2">
          <input
            value={discountInput}
            onChange={e => setDiscountInput(e.target.value)}
            placeholder="Discount code"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="button" variant="outline" onClick={applyDiscount} disabled={discountLoading}>
            {discountLoading ? '…' : <Tag className="h-4 w-4" />}
          </Button>
        </div>
        {discountError   && <p className="text-sm text-destructive">{discountError}</p>}
        {discountSuccess && <p className="text-sm text-green-600">{discountSuccess}</p>}

        <Button
          className="w-full"
          onClick={() => isSignedIn
            ? openPaywall(discountCode, finalPrice)
            : navigate('/auth')}
        >
          {isSignedIn ? `Unlock for ₦${Number(finalPrice ?? template.price).toLocaleString()}` : 'Sign in to unlock'}
        </Button>
      </div>
    );
  }

  // ── Main editor ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b flex items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">{template.name}</h1>
          <p className="text-xs text-muted-foreground">
            Page {currentPageIndex + 1} of {templatePages.length}
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => setShowBulkEdit(v => !v)}>
          <Sparkles className="h-4 w-4 mr-1.5" />
          Fill Details
        </Button>

        <Button variant="outline" size="sm" onClick={handleExportPDF}>
          <Download className="h-4 w-4 mr-1.5" />
          PDF
        </Button>

        <VideoExportDialog
          template={template}
          templatePages={templatePages}
          renderPageToImageUrl={renderPageToImageUrl}
          refetchKey={videoAccessKey}
        />
      </div>

      {/* Bulk text edit */}
      {showBulkEdit && (
        <div className="px-4 pt-3">
          <BulkTextEdit
            textIds={editableTextBlocks.map(tb => tb.id)}
            textBlocks={editableTextBlocks}
            onBulkEdit={handleBulkApply}
          />
        </div>
      )}

      <div className="flex flex-col lg:flex-row flex-1 gap-4 p-4">

        {/* ── Canvas preview ── */}
        <div className="flex-1 flex flex-col items-center">

          {/* Page navigation */}
          {templatePages.length > 1 && (
            <div className="flex items-center gap-3 mb-3">
              <Button variant="ghost" size="icon"
                disabled={currentPageIndex === 0}
                onClick={() => setCurrentPageIndex(i => i - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPageIndex + 1} / {templatePages.length}
              </span>
              <Button variant="ghost" size="icon"
                disabled={currentPageIndex === templatePages.length - 1}
                onClick={() => setCurrentPageIndex(i => i + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Canvas */}
          {currentPage && (
            <div
              className="relative border rounded-md shadow-sm overflow-hidden bg-white"
              style={{
                width:  canvasWidth  * PREVIEW_SCALE,
                height: canvasHeight * PREVIEW_SCALE,
              }}
            >
              {renderPage(resolvedCurrentPage ?? currentPage)}
            </div>
          )}
        </div>

        {/* ── Side panel ── */}
        <div className="w-full lg:w-72 space-y-4">

          {/* Vary layout controls */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">Vary Layout</p>
                <p className="text-[11px] text-muted-foreground">Randomise positions, fonts and masks</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={varyLayout}
                onClick={() => setVaryLayout(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${varyLayout ? 'bg-gold' : 'bg-muted'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${varyLayout ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </div>
            {varyLayout && (
              <button
                type="button"
                onClick={() => setVarianceSeed(s => s + 1)}
                className="w-full text-xs text-center py-1.5 rounded-md border border-dashed border-gold/40 text-gold hover:bg-gold/5 transition-colors"
              >
                ↺ Try another variation
              </button>
            )}
          </div>

          {/* Vibe selector */}
          {vibes.length > 0 && (
            <div className="rounded-lg border p-3">
              <VibeSelector
                vibes={vibes}
                selectedVibeId={draft.vibeId}
                onSelect={handleVibeSelect}
                loading={loadingVibes}
                templateId={template?.id}
                templateName={template?.name}
                category={template?.category}
                aiEnabled={false}  // flip to true once ANTHROPIC_API_KEY is set
              />
            </div>
          )}

          {/* Palette selector */}
          {palettes.length > 0 && (
            <div className="rounded-lg border p-3">
              <PaletteSelector
                palettes={palettes}
                selectedPaletteId={draft.paletteId}
                onSelect={id => setPaletteId(draft.paletteId === id ? null : id)}
                loading={loadingPalettes}
              />
            </div>
          )}

          {/* Image slots for current page */}
          {editableImageBlocks.length > 0 && (
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-sm font-medium">Photos — Page {currentPageIndex + 1}</p>
              {editableImageBlocks.map((block, i) => {
                const hasImage = !!userImageUrls[block.id];
                const isPositioning = positioningSlot === block.id;
                const transform = draft.imageTransforms[block.id] ?? DEFAULT_TRANSFORM;

                return (
                  <div key={block.id} className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Photo {i + 1}</p>

                    {/* Upload / clear row */}
                    <div className="flex gap-2">
                      <Button
                        type="button" variant="outline" size="sm"
                        className="flex-1 text-xs"
                        onClick={() => openFilePicker(block.id)}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        {hasImage ? 'Change' : 'Upload'}
                      </Button>
                      {hasImage && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => clearSlot(block.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Positioning controls */}
                    {hasImage && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button" variant={isPositioning ? 'default' : 'outline'}
                          size="icon" className="h-7 w-7"
                          onClick={() => setPositioningSlot(isPositioning ? null : block.id)}
                          title={isPositioning ? 'Done positioning' : 'Pan image'}
                        >
                          <Move className="h-3 w-3" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" className="h-7 w-7"
                          onClick={() => adjustZoom(block.id, 0.1)} title="Zoom in">
                          <ZoomIn className="h-3 w-3" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" className="h-7 w-7"
                          onClick={() => adjustZoom(block.id, -0.1)} title="Zoom out">
                          <ZoomOut className="h-3 w-3" />
                        </Button>
                        <span className="text-xs text-muted-foreground ml-1">
                          {Math.round(transform.scale * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Per-field text editing for current page */}
          {currentPage?.layout_json?.textBlocks?.filter(tb => tb.editable !== false).map(tb => (
            <div key={tb.id} className="space-y-1">
              <label className="text-xs text-muted-foreground capitalize">
                {tb.id.replace(/_/g, ' ')}
              </label>
              {(tb.defaultText?.length ?? 0) >= 60 ? (
                <textarea
                  rows={2}
                  value={draft.textValues[tb.id] ?? ''}
                  onChange={e => setOneText(tb.id, e.target.value)}
                  placeholder={`Type ${tb.id}${tb.defaultText ? ` (e.g. ${tb.defaultText})` : ''}`}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              ) : (
                <input
                  type="text"
                  value={draft.textValues[tb.id] ?? ''}
                  onChange={e => setOneText(tb.id, e.target.value)}
                  placeholder={`Type ${tb.id}${tb.defaultText ? ` (e.g. ${tb.defaultText})` : ''}`}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              )}
            </div>
          ))}

        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}