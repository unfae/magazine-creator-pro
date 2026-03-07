import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Upload, X, Image, ArrowLeft, Sparkles, ChevronLeft, ChevronRight, Download, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useTemplateAccess } from '@/hooks/useTemplateAccess'
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { logTemplateExport } from '@/lib/exportLog';
import { PageDownloadDialog } from '@/components/PageDownloadDialog';
import { getAllowedFontsCached, ensureGoogleFontsLoaded } from '@/lib/fontLoader';
import { BulkTextEdit } from '@/components/BulkTextEdit';
import { scheduleExportAssetsForDeletion } from '@/lib/scheduleExportAssetsForDeletion';
import { useVideoExport } from '@/hooks/useVideoExport';  // ✅ Add this
import html2canvas from 'html2canvas';



type TextBlock = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  defaultText?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  lineHeight?: number;
  letterSpacing?: number;
  color?: string;
  align?: string;
  zIndex?: number;
  rotate?: number;
  editable?: boolean;
};

type ImageBorder = {
  width?: number;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
};

type ImageBlock = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  borderRadius?: number;
  rotate?: number;
  defaultImageUrl?: string;
  border?: ImageBorder;
  editable?: boolean;
};

type TemplatePage = {
  id: string;
  template_id: string;
  page_number: number;
  page_image_url?: string;
  layout_json: {
    textBlocks?: TextBlock[];
    imageBlocks?: ImageBlock[];
  };
};

export default function CreateMagazinePage() {
  const { templateSlug } = useParams();
  const navigate = useNavigate();
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const perSlotFileInputRef = useRef<HTMLInputElement | null>(null);

  const [template, setTemplate] = useState<any | undefined>(() => undefined);
  const [title, setTitle] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const filesRef = useRef<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const [templatePages, setTemplatePages] = useState<TemplatePage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false); // pages load separately after template meta
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const pageNumbers = templatePages.map((pg) => pg.page_number);

  // When a 100% discount code is applied, we pass price: 0 to useTemplateAccess so it
  // treats the template as free — no Paystack call needed, hasAccess becomes true immediately.
  const [discountedToFree, setDiscountedToFree] = useState(false);

  // If the user applied a 100% discount code, temporarily treat the template as free.
  // useTemplateAccess sees price === 0 → sets hasAccess = true immediately.
  const templatePay = discountedToFree && template
    ? { ...template, price: 0 }
    : template;

  const { hasTemplateAccess, loading, openPaywall } = useTemplateAccess(templatePay);

  const [userImages, setUserImages] = useState<Record<number, Record<string, string>>>({});
  const [userTexts, setUserTexts] = useState<Record<number, Record<string, string>>>({});
  const [bulkTextValues, setBulkTextValues] = useState<Record<string, string>>({});

  // Discount code state for the paywall UI
  const [discountCode, setDiscountCode] = useState('');
  const [isApplyingCode, setIsApplyingCode] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    discountType: 'percent' | 'fixed';
    discountValue: number;
    finalAmount: number;
  } | null>(null);

  // Validate and apply discount code client-side before checkout
  const handleApplyDiscountCode = async () => {
    if (!discountCode.trim() || !template) return;

    setIsApplyingCode(true);
    try {
      const { data: codeRow, error } = await supabase
        .from('template_discount_codes')
        .select('*')
        .eq('code', discountCode.trim().toUpperCase())
        .eq('template_id', template.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !codeRow) {
        toast.error('Invalid or expired discount code');
        setAppliedDiscount(null);
        return;
      }

      // Check expiry
      if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
        toast.error('This discount code has expired');
        setAppliedDiscount(null);
        return;
      }

      // Check max uses
      if (codeRow.max_uses !== null && codeRow.uses_count >= codeRow.max_uses) {
        toast.error('This discount code has reached its usage limit');
        setAppliedDiscount(null);
        return;
      }

      // Calculate final amount
      const originalPrice = Number(template.price);
      let finalAmount: number;

      if (codeRow.discount_type === 'percent') {
        finalAmount = originalPrice * (1 - codeRow.discount_value / 100);
      } else {
        // fixed
        finalAmount = Math.max(0, originalPrice - codeRow.discount_value);
      }

      finalAmount = Math.round(finalAmount * 100) / 100;

      // ✅ 100% discount — unlock immediately without going to Paystack at all.
      // We set discountedToFree which makes templatePay.price = 0, which triggers
      // useTemplateAccess to set hasAccess = true (free template path). No payment needed.
      if (finalAmount === 0) {
        setDiscountedToFree(true);
        setDiscountCode('');
        setAppliedDiscount(null);
        toast.success('100% discount applied! Template is now unlocked.');
        return;
      }

      setAppliedDiscount({
        code: codeRow.code,
        discountType: codeRow.discount_type,
        discountValue: codeRow.discount_value,
        finalAmount,
      });

      toast.success('Discount code applied!');
    } catch (err) {
      console.error('Error validating discount code:', err);
      toast.error('Could not validate discount code. Please try again.');
    } finally {
      setIsApplyingCode(false);
    }
  };

  const currentSlotTargetRef = useRef<{ pageNumber: number; slotId: string } | null>(null);

  const PREVIEW_SCALE = 0.3;
  const PAGE_WIDTH = 1000;
  const PAGE_HEIGHT = 1415;

  const { exportVideo, isExportingVideo } = useVideoExport();  // ✅ Add this

  // Helper: is this a paid template?
  const isPaidTemplate = (template?.price ?? 0) > 0;


  useEffect(() => {
    let mounted = true;

    const fetchTemplateAndPages = async () => {
      setLoadingTemplate(true);

      // ─── Step 1: fetch template row ───────────────────────────────────────────
      // Set template immediately so the header, price UI, and paywall card all
      // render right away — without waiting for pages to load.
      const { data: tmpl, error: tErr } = await supabase
        .from('templates')
        .select('*')
        .eq('slug', templateSlug)
        .single();

      if (tErr || !tmpl) {
        console.error('Error fetching template:', tErr);
        toast.error('Template not found');
        setLoadingTemplate(false);
        return;
      }

      if (!mounted) return;

      // ✅ Set template immediately — title, description, and paywall card are visible now
      setTemplate(tmpl);
      setLoadingTemplate(false);

      // ─── Step 2: fetch pages in the background ────────────────────────────────
      // Pages load separately so the paywall/discount UI is never blocked by them.
      setLoadingPages(true);

      const { data: pages, error: pErr } = await supabase
        .from('template_pages')
        .select('*')
        .eq('template_id', tmpl.id)
        .order('page_number', { ascending: true });

      if (pErr) {
        console.error('Error fetching template pages:', pErr);
        toast.error('No template pages found');
        setLoadingPages(false);
        return;
      }

      if (!mounted) return;

      const initialTexts: Record<number, Record<string, string>> = {};
      const initialImages: Record<number, Record<string, string>> = {};

      (pages || []).forEach((pg: any) => {
        const pn = pg.page_number;
        initialTexts[pn] = {};
        initialImages[pn] = {};

        const layout = pg.layout_json ?? {};
        (layout.textBlocks ?? []).forEach((tb: TextBlock) => {
          const bulkValue = bulkTextValues[tb.id];
          initialTexts[pn][tb.id] = bulkValue ?? tb.defaultText ?? '';
        });
        (layout.imageBlocks ?? []).forEach((ib: ImageBlock) => {
          initialImages[pn][ib.id] = '';
        });
      });

      setTemplatePages(pages || []);
      setUserTexts(initialTexts);
      setUserImages(initialImages);
      setLoadingPages(false);
    };

    if (templateSlug) fetchTemplateAndPages();

    return () => {
      mounted = false;
    };
    }, [templateSlug, bulkTextValues]);

  useEffect(() => {
    if (templatePages.length === 0) return;

    (async () => {
      const allowed = await getAllowedFontsCached();
      const allowedSet = new Set(allowed.map((f) => f.toLowerCase()));

      const fontsUsed = new Set<string>();
      templatePages.forEach((pg) => {
        (pg.layout_json?.textBlocks ?? []).forEach((tb: any) => {
          const f = (tb.fontFamily ?? '').trim();
          if (f && allowedSet.has(f.toLowerCase())) fontsUsed.add(f);
        });
      });

      ensureGoogleFontsLoaded([...fontsUsed]);
    })();
  }, [templatePages]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setIsSignedIn(!!data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(!!session);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (loadingTemplate) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl animate-pulse">
        {/* Back button skeleton */}
        <div className="h-5 w-36 rounded bg-muted mb-6" />

        {/* Header section skeleton */}
        <div className="mb-6">
          <div className="h-8 w-72 rounded bg-muted mb-3" />
          <div className="h-4 w-96 rounded bg-muted mb-2" />
          <div className="h-4 w-48 rounded bg-muted mt-3" />
        </div>

        {/* Paywall card skeleton */}
        <div className="rounded-xl border bg-card mb-6 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-4 w-44 rounded bg-muted" />
              <div className="h-3 w-28 rounded bg-muted" />
            </div>
            <div className="h-9 w-36 rounded bg-gold/10" />
          </div>
        </div>

        {/* Page preview skeleton */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-8 w-8 rounded-md bg-muted" />
              <div className="h-8 w-8 rounded-md bg-muted" />
            </div>
          </div>
          <div className="flex gap-6 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 rounded-lg bg-muted"
                style={{ width: PAGE_WIDTH * PREVIEW_SCALE, height: PAGE_HEIGHT * PREVIEW_SCALE }}
              />
            ))}
          </div>
        </div>

        {/* Controls card skeleton */}
        <div className="rounded-xl border bg-card mb-6 p-6 space-y-6">
          {/* Title input */}
          <div>
            <div className="h-4 w-32 rounded bg-muted mb-2" />
            <div className="h-10 w-80 rounded-lg bg-muted" />
          </div>
          {/* Bulk upload */}
          <div>
            <div className="h-4 w-36 rounded bg-muted mb-2" />
            <div className="h-24 w-full rounded-lg bg-muted" />
          </div>
          {/* Bulk text edit */}
          <div>
            <div className="h-4 w-28 rounded bg-muted mb-2" />
            <div className="h-10 w-full rounded-lg bg-muted" />
          </div>
        </div>

        {/* Export buttons skeleton */}
        <div className="flex justify-end gap-3 mt-4">
          <div className="h-9 w-36 rounded-lg bg-muted" />
          <div className="h-9 w-28 rounded-lg bg-gold/10" />
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-serif mb-4">Template not found</h1>
        <Button variant="outline" onClick={() => navigate('/templates')}>
          Back to Templates
        </Button>
      </div>
    );
  }

  const buildTemplatePageUrl = (templateSlug: string, pageIndex: number) => {
    const origin = `https://${(import.meta.env.VITE_SUPABASE_URL as string).replace(/^https?:\/\//, '')}`;
    return `${origin}/storage/v1/object/public/template_pages/${templateSlug}/${pageIndex}.png`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasTemplateAccess) {
      // ✅ Wrapped in arrow function — prevents click event being passed as discountCode
      openPaywall();
      return;
    }

    const files = e.target.files;
    if (!files) return;

    const newPhotos: string[] = [];
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        newPhotos.push(url);
        filesRef.current.push(file);
      }
    });

    if (photos.length + newPhotos.length > (template.required_photos ?? 0) + 50) {
      toast.error(`Maximum ${(template.required_photos ?? 0) + 50} photos allowed`);
      newPhotos.forEach((u) => URL.revokeObjectURL(u));
      filesRef.current.splice(filesRef.current.length - newPhotos.length, newPhotos.length);
      return;
    }

    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    URL.revokeObjectURL(newPhotos[index]);
    newPhotos.splice(index, 1);
    if (filesRef.current[index]) filesRef.current.splice(index, 1);
    setPhotos(newPhotos);
  };

  const applyNextImageToTemplate = (imageUrl: string) => {
    setUserImages((prev) => {
      const next = structuredClone(prev);

      const allSlots: { pageNumber: number; slotId: string }[] = [];
      for (const pg of templatePages) {
        const layout = pg.layout_json;
        if (!layout?.imageBlocks) continue;
        for (const ib of layout.imageBlocks) {
          if (ib.editable !== false) {
            allSlots.push({ pageNumber: pg.page_number, slotId: ib.id });
          }
        }
      }

      const allImageUrls = photos;

      for (let i = 0; i < allSlots.length; i++) {
        const slot = allSlots[i];
        const imageUrl = allImageUrls[i % allImageUrls.length];

        next[slot.pageNumber] ??= {};
        next[slot.pageNumber][slot.slotId] = imageUrl;
      }

      return next;
    });
  };

  const getAvailableEmptySlots = () => {
    const emptySlots: { pageNumber: number; slotId: string }[] = [];
    for (const pg of templatePages) {
      const layout = pg.layout_json;
      if (!layout?.imageBlocks) continue;
      for (const ib of layout.imageBlocks) {
        if (ib.editable === false) continue;
        const imageUrl = (userImages[pg.page_number] || {})[ib.id] || '';
        if (!imageUrl) {
          emptySlots.push({ pageNumber: pg.page_number, slotId: ib.id });
        }
      }
    }
    return emptySlots;
  };


  const handleUploadAll = async () => {
    if (filesRef.current.length === 0) {
      toast.error('No photos selected to upload');
      return;
    }

    setIsGenerating(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error('You must be signed in to upload images');
        setIsGenerating(false);
        navigate('/auth?mode=login');
        return;
      }

      const toastId = toast.loading(
        `Uploading images… 0 of ${filesRef.current.length}`,
        { position: 'top-left' }
      );

      let uploadedCount = 0;
      const publicUrls: string[] = [];

      for (let i = 0; i < filesRef.current.length; i++) {
        const file = filesRef.current[i];
        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage
          .from('magazine-assets')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (error) {
          console.error(error);
          continue;
        }

        const publicUrl = supabase.storage
          .from('magazine-assets')
          .getPublicUrl(data.path).data.publicUrl;

        publicUrls.push(publicUrl);

        uploadedCount++;
        toast.loading(
          `Uploading images… ${uploadedCount} of ${filesRef.current.length} uploaded`,
          { id: toastId }
        );

        // ✅ Apply this image immediately to next slot
        applyNextImageToTemplate(publicUrl);
      }

      // ✅ AFTER ALL UPLOADS: loop over remaining empty slots
      const emptySlots = getAvailableEmptySlots();
      if (emptySlots.length > 0 && publicUrls.length > 0) {
        emptySlots.forEach((slot, idx) => {
          const imageUrl = publicUrls[idx % publicUrls.length];
          setUserImages((prev) => {
            const copy = { ...prev };
            copy[slot.pageNumber] = { ...(copy[slot.pageNumber] || {}) };
            copy[slot.pageNumber][slot.slotId] = imageUrl;
            return copy;
          });
        });
      }

      // Update photos once at the end
      setPhotos((prev) => [...prev, ...publicUrls]);
      filesRef.current = [];

      toast.success(
        `Images uploaded successfully (${uploadedCount}/${filesRef.current.length})`,
        { id: toastId }
      );
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong uploading images. Try uploading 1 by 1');
    } finally {
      setIsGenerating(false);
    }
  };


  const handleTextChange = (pageNumber: number, textId: string, value: string) => {
    setUserTexts((prev) => {
      const copy = { ...prev };
      copy[pageNumber] = { ...(copy[pageNumber] || {}) };
      copy[pageNumber][textId] = value;
      return copy;
    });
  };

  const handleReplaceSlotClick = (pageNumber: number, slotId: string) => {
    if (!isSignedIn) {
      toast.error('Sign in required');
      navigate('/auth?mode=login');
      return;
    }

    const pg = templatePages.find((p) => p.page_number === pageNumber);
    const ib = pg?.layout_json?.imageBlocks?.find((b: ImageBlock) => b.id === slotId);
    if (ib && ib.editable === false) return;

    if (!hasTemplateAccess) {
      // ✅ Called programmatically — safe, not an event handler
      openPaywall();
      return;
    }

    currentSlotTargetRef.current = { pageNumber, slotId };
    if (perSlotFileInputRef.current) perSlotFileInputRef.current.click();
  };

  const handlePerSlotFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !currentSlotTargetRef.current) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    const target = currentSlotTargetRef.current;
    const pg = templatePages.find((p) => p.page_number === target.pageNumber);
    const ib = pg?.layout_json?.imageBlocks?.find((b: ImageBlock) => b.id === target.slotId);
    if (ib && ib.editable === false) {
      currentSlotTargetRef.current = null;
      if (perSlotFileInputRef.current) perSlotFileInputRef.current.value = '';
      return;
    }

    const toastId = toast.loading('Uploading image…', { position: 'top-left' });

    setIsGenerating(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error('Sign in required', { id: toastId });
        setIsGenerating(false);
        return;
      }

      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('magazine-assets').upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload image', { id: toastId });
        setIsGenerating(false);
        return;
      }

      const url = supabase.storage.from('magazine-assets').getPublicUrl(uploadData.path).data?.publicUrl ?? (uploadData?.publicUrl ?? '');

      setUserImages((prev) => {
        const copy = { ...prev };
        copy[target.pageNumber] = { ...(copy[target.pageNumber] || {}) };
        copy[target.pageNumber][target.slotId] = url;
        return copy;
      });

      toast.success('Image replaced', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to replace image');
    } finally {
      setIsGenerating(false);
      currentSlotTargetRef.current = null;
      if (perSlotFileInputRef.current) perSlotFileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a magazine title');
      return;
    }

    setIsGenerating(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error('You must be signed in to generate a magazine');
        setIsGenerating(false);
        navigate('/auth?mode=login');
        return;
      }

      const { data: magData, error: magError } = await supabase.from('magazines').insert([
        {
          owner: user.id,
          title: title,
          description: template.description ?? null,
          template_id: template.id,
          thumbnail_url: template.thumbnail_url ?? null,
          metadata: JSON.stringify({ createdFromTemplate: template.id }),
          is_published: false,
        },
      ]).select().single();

      if (magError || !magData) {
        console.error('Error creating magazine:', magError);
        toast.error('Failed to create magazine');
        setIsGenerating(false);
        return;
      }

      const pageInserts = templatePages.map((pg) => {
        const pn = pg.page_number;
        const pageUserImages = userImages[pn] ?? {};
        const pageUserTexts = userTexts[pn] ?? {};
        return {
          magazine_id: magData.id,
          template_id: template.id,
          page_number: pn,
          user_images: pageUserImages,
          user_texts: pageUserTexts,
        };
      });

      const { error: pagesError } = await supabase.from('magazine_pages').insert(pageInserts);

      if (pagesError) {
        console.error('Error inserting magazine pages:', pagesError);
        toast.error('Failed to save magazine pages');
        setIsGenerating(false);
        return;
      }

      toast.success('Magazine saved as draft successfully!');
      navigate('/magazines');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong while saving magazine. Please refresh and try again');
    } finally {
      setIsGenerating(false);
    }
  };

  const progress = Math.min((photos.length / (template.required_photos ?? 1)) * 100, 100);

  const goPrev = () => setCurrentPageIndex((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentPageIndex((i) => Math.min(templatePages.length - 1, i + 1));



  // Add this inside CreateMagazinePage, ABOVE handleExportPDF
  const renderPageToImageUrl = async (pg: TemplatePage): Promise<string | null> => {
    const PAGE_WIDTH = 1000;
    const PAGE_HEIGHT = 1415;

    const original = document.getElementById(`page-${pg.page_number}`);
    if (!original) return null;

    const clone = original.cloneNode(true) as HTMLElement;

    clone.querySelectorAll('[data-image-slot="true"]').forEach((slotEl) => {
      const slot = slotEl as HTMLElement;
      const img = slot.querySelector('img') as HTMLImageElement | null;
      if (!img || !img.src) return;

      slot.style.backgroundImage = `url(${img.src})`;
      slot.style.backgroundSize = 'cover';
      slot.style.backgroundPosition = 'center';
      slot.style.backgroundRepeat = 'no-repeat';
      img.style.display = 'none';
    });

    clone.querySelectorAll('[data-ui="true"]').forEach((el) => el.remove());

    clone.querySelectorAll('[data-text-block="true"]').forEach((el) => {
      const t = el as HTMLElement;
      t.style.overflow = 'visible';
      t.style.boxSizing = 'border-box';
      t.style.paddingBottom = '3px';
    });

    clone.style.width = `${PAGE_WIDTH}px`;
    clone.style.height = `${PAGE_HEIGHT}px`;
    clone.style.transform = 'none';
    clone.style.position = 'absolute';
    clone.style.left = '-99999px';
    clone.style.top = '0';

    document.body.appendChild(clone);
    await document.fonts.ready;

    const canvas = await html2canvas(clone, {
      scale: 1,
      useCORS: true,
      backgroundColor: '#ffffff',
      imageTimeout: 30000,
    });

    document.body.removeChild(clone);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
    );
    if (!blob) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const emailSafe = (user.email || 'user').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const templateSafe = (template.name || 'template').replace(/[^a-z0-9]/gi, '_').toLowerCase();

    const filePath = `${emailSafe}/${templateSafe}/page-${pg.page_number}-${Date.now()}.jpg`;

    const { data, error } = await supabase.storage
      .from('generated-magazines')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error || !data) {
      console.error('Page upload error', error);
      return null;
    }

    const publicUrl = supabase.storage
      .from('generated-magazines')
      .getPublicUrl(data.path).data.publicUrl;

    return publicUrl || null;
  };




  const handleExportPDF = async () => {
    if (templatePages.length === 0) {
      toast.error('No pages to export');
      return;
    }

    setIsGenerating(true);

    try {
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;
      const { jsPDF } = await import('jspdf');

      const PAGE_WIDTH = 1000;
      const PAGE_HEIGHT = 1415;
      const SCALE = 1;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [PAGE_WIDTH, PAGE_HEIGHT],
        compress: true,
      });

      for (let i = 0; i < templatePages.length; i++) {
        const pg = templatePages[i];
        const original = document.getElementById(`page-${pg.page_number}`);

        if (!original) continue;

        const clone = original.cloneNode(true) as HTMLElement;

        clone.querySelectorAll('[data-image-slot="true"]').forEach((slotEl) => {
          const slot = slotEl as HTMLElement;
          const img = slot.querySelector('img') as HTMLImageElement | null;
          if (!img || !img.src) return;

          slot.style.backgroundImage = `url(${img.src})`;
          slot.style.backgroundSize = 'cover';
          slot.style.backgroundPosition = 'center';
          slot.style.backgroundRepeat = 'no-repeat';
          img.style.display = 'none';
        });

        clone.style.width = `${PAGE_WIDTH}px`;
        clone.style.height = `${PAGE_HEIGHT}px`;
        clone.style.transform = 'none';
        clone.style.position = 'absolute';
        clone.style.left = '-99999px';
        clone.style.top = '0';

        clone.querySelectorAll('[data-ui="true"]').forEach((el) => el.remove());

        clone.querySelectorAll('[data-text-block="true"]').forEach((el) => {
          const t = el as HTMLElement;
          t.style.overflow = "visible";
          t.style.boxSizing = "border-box";
          t.style.paddingBottom = "3px";
        });

        document.body.appendChild(clone);
        await document.fonts.ready;

        const canvas = await html2canvas(clone, {
          scale: SCALE,
          useCORS: true,
          backgroundColor: null,
          imageTimeout: 30000,
        });

        document.body.removeChild(clone);

        const imgData = canvas.toDataURL('image/jpeg', 1.0);

        if (i > 0) pdf.addPage();

        pdf.addImage(imgData, 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT, undefined, 'FAST');
      }

      const { data: { user } } = await supabase.auth.getUser();
      const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'user';
      const safe = (s: string) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase();

      pdf.save(`${safe(userName)}_${safe(template.name)}_magazine.pdf`);

      try {
        await logTemplateExport({
          userId: user.id,
          userEmail: user.email,
          userName: user.user_metadata?.full_name,
          templateId: template.id,
          templateName: template.name,
          exportType: 'pdf',
          pageCount: templatePages.length,
          isPaidTemplate,  // ✅ pass paid flag for export count tracking
          meta: { templateSlug: template.slug },
        });
      } catch (e) {
        console.error('Export logging failed', e);
      }

      await scheduleExportAssetsForDeletion(user.id, template.id);

      toast.success('Magazine exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PDF');
    } finally {
      setIsGenerating(false);
    }
  };




  const handleExportVideo = async () => {
    if (templatePages.length === 0) {
      toast.error('No pages to export');
      return;
    }

    setIsGenerating(true);

    const SUBTITLE = 'Kindly hold on briefly while your video is being prepared...';

    // Progress state for this export run
    let progress = 0;

    // Create ONE persistent toast (this is the only toast we will ever update)
    const toastId = toast.loading(`Generating Video... ${progress}%`, {
      position: 'top-left',
      duration: Infinity,
      description: SUBTITLE,
    });

    // Smooth ticking 0 → 45 (so user sees 0,1,2,3... immediately)
    let stopTick = false;
    const tick = setInterval(() => {
      if (stopTick) return;

      // cap at 45% until page rendering completes
      progress = Math.min(progress + 1, 45);

      toast.loading(`Generating Video... ${progress}%`, {
        id: toastId,
        position: 'top-left',
        duration: Infinity,
        description: SUBTITLE,
      });
    }, 900);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        stopTick = true;
        clearInterval(tick);

        toast.error(`Generating Video... ${progress}%`, {
          id: toastId,
          position: 'top-left',
          duration: Infinity,
          description: 'Sign in required.',
        });
        return;
      }

      // Render + upload composed page images to Supabase
      const maxPages = Math.min(templatePages.length, 8);
      const renderedUrls: (string | null)[] = [];

      for (let i = 0; i < maxPages; i++) {
        const pg = templatePages[i];
        const url = await renderPageToImageUrl(pg);
        renderedUrls.push(url);
      }

      const pageUrls = renderedUrls.filter((u): u is string => !!u);

      if (pageUrls.length === 0) {
        stopTick = true;
        clearInterval(tick);

        toast.error(`Generating Video... ${progress}%`, {
          id: toastId,
          position: 'top-left',
          duration: Infinity,
          description: 'Failed to prepare pages. Please try again.',
        });
        return;
      }

      // Stop page ticking, jump to 50% for the Shotstack phase
      stopTick = true;
      clearInterval(tick);

      progress = 50;
      toast.loading(`Generating Video... ${progress}%`, {
        id: toastId,
        position: 'top-left',
        duration: Infinity,
        description: SUBTITLE,
      });

      // Hand off to Shotstack (IMPORTANT: pass toastId + current progress)
      await exportVideo(pageUrls, template, user.id, toastId, progress);

      try {
        // ✅ Log video export with paid flag
        await logTemplateExport({
          userId: user.id,
          userEmail: user.email,
          userName: user.user_metadata?.full_name,
          templateId: template.id,
          templateName: template.name,
          exportType: 'video',
          pageCount: templatePages.length,
          isPaidTemplate,
          meta: { templateSlug: template.slug },
        });
      } catch (e) {
        console.error('Export logging failed', e);
      }

    } catch (err) {
      console.error(err);
      stopTick = true;
      clearInterval(tick);

      toast.error(`Generating Video... ${progress}%`, {
        id: toastId,
        position: 'top-left',
        duration: Infinity,
        description: 'Video export failed. Please try again.',
      });
    } finally {
      // Ensure interval is always cleared
      stopTick = true;
      clearInterval(tick);
      setIsGenerating(false);
    }
  };




  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <button
        onClick={() => navigate('/templates')}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Templates
      </button>

      <div className="mb-6 animate-fade-in">
        <h1 className="text-editorial-md mb-2">Create Your {template.name} Magazine</h1>
        <p className="text-muted-foreground">{template.description}</p>
        <div className="mt-3">
          <p className="text-muted-foreground font-semibold">
            {template.pageCount} pages • {template.requiredPhotos} photos max.
          </p>
        </div>

        {template.cta_link_url ? (
          <div className="mt-4">
            <Button
              asChild
              variant="outline"
              className="border-gold text-gold hover:bg-gold/10"
            >
              <a
                href={template.cta_link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-base font-medium"
              >
                {template.cta_link_text}
                <ChevronRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        ) : null}

      </div>

      {/* Paywall card — shown as soon as template.price > 0 is known.
           We no longer gate on !loading (useTemplateAccess loading) because that causes
           a second network-wait delay. Instead:
           • While loading=true  → show a skeleton so the card appears immediately
           • While loading=false and hasAccess → hide the card entirely
           • While loading=false and !hasAccess → show the full paywall UI */}
      {template?.price > 0 && !hasTemplateAccess && (
        <Card className="mb-6">
          <div className="p-6">

            {/* Skeleton state — access check is still in flight */}
            {loading && (
              <div className="flex items-center justify-between gap-4 animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 w-44 rounded bg-muted" />
                  <div className="h-3 w-28 rounded bg-muted" />
                </div>
                <div className="h-9 w-36 rounded bg-muted" />
              </div>
            )}

            {/* Full paywall UI — access check complete, user has not paid */}
            {!loading && (
              <>
                {/* Price row — stacks on mobile, side by side on desktop */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                  <div>
                    <p className="font-medium">This template is paid.</p>

                    {/* Show original + discounted price if a code is applied, else just original */}
                    {appliedDiscount ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-muted-foreground line-through">
                          ₦{Number(template.price).toLocaleString()}
                        </p>
                        <p className="text-sm font-semibold text-gold">
                          ₦{appliedDiscount.finalAmount.toLocaleString()}
                        </p>
                        {appliedDiscount.discountType === 'percent' ? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gold/10 text-gold font-medium">
                            {appliedDiscount.discountValue}% off
                          </span>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gold/10 text-gold font-medium">
                            ₦{appliedDiscount.discountValue.toLocaleString()} off
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Cost: ₦{Number(template.price).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Unlock button — desktop only (shown beside price) */}
                  {/* ✅ Passes finalAmount so Paystack receives the discounted price, not the original */}
                  <Button
                    variant="gold"
                    className="hidden sm:inline-flex"
                    onClick={() => openPaywall(
                      appliedDiscount?.code || discountCode.trim() || undefined,
                      appliedDiscount?.finalAmount
                    )}
                  >
                    Unlock Template
                  </Button>
                </div>

                {/* Discount code input + Apply/Remove */}
                <div className="flex items-center gap-2 max-w-xs">
                  <div className="relative flex-1">
                    <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={discountCode}
                      onChange={(e) => {
                        setDiscountCode(e.target.value.toUpperCase());
                        // Clear applied discount if code is changed
                        if (appliedDiscount) setAppliedDiscount(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyDiscountCode()}
                      placeholder="Discount code"
                      className="pl-8 h-8 text-sm uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal"
                    />
                  </div>

                  {/* Underline text Apply button */}
                  {discountCode.trim() && !appliedDiscount && (
                    <button
                      onClick={handleApplyDiscountCode}
                      disabled={isApplyingCode}
                      className="text-sm text-gold underline underline-offset-2 hover:text-gold/80 transition-colors shrink-0 disabled:opacity-50"
                    >
                      {isApplyingCode ? 'Applying...' : 'Apply'}
                    </button>
                  )}

                  {/* Show a remove link if code is already applied */}
                  {appliedDiscount && (
                    <button
                      onClick={() => { setAppliedDiscount(null); setDiscountCode(''); }}
                      className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Unlock button — mobile only (shown below discount input) */}
                {/* ✅ Same fix: passes finalAmount so Paystack receives the discounted price */}
                <Button
                  variant="gold"
                  className="mt-4 w-full sm:hidden"
                  onClick={() => openPaywall(
                    appliedDiscount?.code || discountCode.trim() || undefined,
                    appliedDiscount?.finalAmount
                  )}
                >
                  Unlock Template
                </Button>
              </>
            )}

          </div>
        </Card>
      )}

      {/* Page preview section — shows a skeleton while pages load in the background */}
      {loadingPages && (
        <div className="mb-6">
          <div className="text-sm text-muted-foreground mb-3">Preview pages (click to edit)</div>
          <div className="flex gap-6 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 rounded-lg bg-muted animate-pulse"
                style={{ width: PAGE_WIDTH * PREVIEW_SCALE, height: PAGE_HEIGHT * PREVIEW_SCALE }}
              />
            ))}
          </div>
        </div>
      )}

      {!loadingPages && <div className="mb-6 relative">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground">Preview pages (click to edit)</div>
          <div className="flex gap-2">
            <button onClick={goPrev} className="p-2 rounded-md border">
              <ChevronLeft />
            </button>
            <button onClick={goNext} className="p-2 rounded-md border">
              <ChevronRight />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <div className="flex gap-6" style={{ width: `${templatePages.length * 100}%` }}>
            {templatePages.map((pg, idx) => {
              const layout = pg.layout_json ?? {};
              const bgUrl = pg.page_image_url || buildTemplatePageUrl(template.slug, pg.page_number);

              return (
                <div
                  key={pg.id}
                  className="flex-shrink-0"
                  style={{
                    width: PAGE_WIDTH * PREVIEW_SCALE,
                    height: PAGE_HEIGHT * PREVIEW_SCALE,
                  }}
                  onClick={() => setCurrentPageIndex(idx)}
                >
                  <div
                    id={`page-${pg.page_number}`}
                    className="relative rounded-lg overflow-hidden bg-border"
                    style={{
                      width: PAGE_WIDTH,
                      height: PAGE_HEIGHT,
                      backgroundImage: `url(${bgUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      transform: `scale(${PREVIEW_SCALE})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    {(layout.imageBlocks ?? []).map((ib: ImageBlock) => {
                      const slotUrl = (userImages[pg.page_number] || {})[ib.id] || ib.defaultImageUrl || '';
                      const bw = ib.border?.width;
                      const bc = ib.border?.color;
                      const bs = ib.border?.style ?? 'solid';
                      const isEditable = ib.editable !== false;

                      return (
                        <div
                          key={ib.id}
                          data-image-slot="true"
                          className={cn(
                            'absolute overflow-hidden rounded-sm flex items-center justify-center',
                            !slotUrl && isEditable && 'bg-gray-100/30',
                            !isEditable && 'pointer-events-none'
                          )}
                          style={{
                            left: ib.x,
                            top: ib.y,
                            width: ib.width,
                            height: ib.height,
                            zIndex: ib.zIndex ?? 1,
                            borderRadius: ib.borderRadius ? `${ib.borderRadius}px` : undefined,
                            transform: `rotate(${ib.rotate ?? 0}deg)`,
                            border: bw && bc ? `${bw}px ${bs} ${bc}` : undefined,
                            pointerEvents: isEditable ? 'auto' : 'none',
                          }}
                          onClick={() => {
                            if (!isEditable) return;
                            handleReplaceSlotClick(pg.page_number, ib.id);
                          }}
                        >
                          {slotUrl ? (
                            <img
                              src={slotUrl}
                              crossOrigin="anonymous"
                              // className="img-reset" 
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: 'center',
                                borderRadius: ib.borderRadius ? `${ib.borderRadius}px` : undefined,
                                pointerEvents: isEditable ? 'auto' : 'none',
                              }}
                            />
                          ) : (
                            <div
                              className="text-xs text-muted-foreground text-center p-2"
                              style={{ pointerEvents: isEditable ? 'auto' : 'none' }}
                            >
                              {ib.editable === false ? 'Locked image' : 'Click to add image'}
                            </div>
                          )}
                          {isEditable && (
                            <button
                              data-ui="true"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReplaceSlotClick(pg.page_number, ib.id);
                              }}
                              className="absolute right-1 top-1 w-7 h-7 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-90"
                              title="Replace image"
                              style={{ pointerEvents: 'auto' }}
                            >
                              <Image className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {(layout.textBlocks ?? []).map((tb: TextBlock) => {
                      const currentText = (userTexts[pg.page_number] || {})[tb.id] ?? tb.defaultText ?? '';
                      const isEditable = tb.editable !== false;

                      return (
                        <div
                          key={tb.id}
                          data-text-block="true"
                          contentEditable={isEditable}
                          suppressContentEditableWarning
                          onBlur={(e: any) => {
                            if (!isEditable) return;
                            handleTextChange(pg.page_number, tb.id, (e.currentTarget as HTMLElement).innerText);
                          }}
                          className={cn('absolute', !isEditable && 'select-none')}
                          style={{
                            left: tb.x,
                            top: tb.y,
                            width: tb.width,
                            height: tb.height,
                            fontSize: (tb.fontSize ?? 16) as number,
                            color: tb.color ?? 'inherit',
                            textAlign: tb.align as any,
                            lineHeight: tb.lineHeight ? `${tb.lineHeight}px` : undefined,
                            letterSpacing: tb.letterSpacing ? `${tb.letterSpacing}px` : undefined,
                            overflow: 'visible',
                            zIndex: tb.zIndex ?? 2,
                            transform: `rotate(${tb.rotate ?? 0}deg)`,
                            fontWeight: tb.fontWeight ?? undefined,
                            fontFamily: tb.fontFamily ?? 'inherit',
                            whiteSpace: 'pre-wrap',
                            //verticalAlign: 'bottom',
                          }}
                          onClick={(e) => {
                            if (tb.editable === false) {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        >
                          {currentText}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>}
      {/* End of !loadingPages pages section */}

      <Card className="mb-6">
        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Magazine Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Summer Memories 2025"
              className="max-w-md"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Bulk Image Upload</label>
            <p className="text-sm text-muted-foreground mb-3">
              Upload your photos and we'll auto-fit them into the template. You can fine-tune each page after. 
              If using an older phone, Upload in batches of 5 for smoother performance.
            </p>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              onClick={() => {
                if (!isSignedIn) {
                  toast.error('You must be signed in to upload images');
                  navigate('/auth?mode=login');
                  return;
                }
                bulkFileInputRef.current?.click();
              }}
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all',
                photos.length === 0 ? 'border-border' : 'border-gold/30'
              )}
            >
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <p className="font-medium">Click to upload photos</p>
                <p className="text-sm text-muted-foreground">{photos.length} selected</p>
              </div>
            </div>
            {photos.length > 0 && (
              <div className="grid grid-cols-4 gap-3 mt-4">
                {photos.map((p, i) => (
                  <div key={i} className="relative aspect-square rounded-md overflow-hidden">
                    <img src={p} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-foreground/80 text-background flex items-center justify-center"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  filesRef.current = [];
                  setPhotos([]);
                }}
              >
                Clear
              </Button>
              <Button variant="gold" onClick={handleUploadAll} disabled={isGenerating || filesRef.current.length === 0}>
                Upload & Apply
              </Button>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Bulk Text Edit</label>
            {(() => {
              const textIds = [...new Set(templatePages.flatMap(pg => 
                (pg.layout_json?.textBlocks ?? []).map(tb => tb.id)
              ))];

              // Very first, just after `pageNumbers` and before `const textIds`
              const textBlocksFromLayout = Array.isArray(templatePages)
                ? Array.from(
                    new Map(
                      templatePages.flatMap(pg =>
                        (pg.layout_json?.textBlocks ?? []).map(tb => [
                          tb.id,
                          {
                            id: tb.id,
                            defaultText: tb.defaultText ?? tb.id,
                          },
                        ])
                      )
                    ).values()
                  )
                : [];


              return (
                <BulkTextEdit
                  textIds={textIds}
                  textBlocks={textBlocksFromLayout} 
                  onBulkEdit={(values) => {
                    setBulkTextValues(prev => ({ ...prev, ...values }));
                    setUserTexts(prev => {
                      const next = { ...prev };
                      templatePages.forEach(pg => {
                        const pn = pg.page_number;
                        next[pn] = { ...(next[pn] || {}) };
                        Object.entries(values).forEach(([id, value]) => {
                          next[pn][id] = value;
                        });
                      });
                      return next;
                    });
                  }}
                />
              );
            })()}
          </div>
        </div>
      </Card>

      <input
        ref={(el) => (perSlotFileInputRef.current = el)}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePerSlotFileSelect}
      />

      <div className="flex flex-wrap justify-end gap-3 mt-4">
        <PageDownloadDialog
          pageNumbers={pageNumbers}
          templateId={template.id}
          templateName={template.name}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPDF}
          disabled={isGenerating || templatePages.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </Button>

         {/* ✅ NEW Video button */}

    
         
        
      </div>
    </div>
  );
}


/*

<Button 
          variant="gold" 
          size="sm" 
          onClick={handleExportVideo} 
          disabled={isGenerating || isExportingVideo || templatePages.length === 0}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Export Video
        </Button> 

*/
