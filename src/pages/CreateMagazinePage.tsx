import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Upload, X, Image, ArrowLeft, Sparkles, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useTemplateAccess } from '@/hooks/useTemplateAccess'
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { PageDownloadDialog } from '@/components/PageDownloadDialog';


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
  width?: number;         // px
  color?: string;         // any valid CSS color: "#fff", "rgba(...)", "red"
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
   

  const { templateId } = useParams();
  const navigate = useNavigate();
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const perSlotFileInputRef = useRef<HTMLInputElement | null>(null);

  // kept names..
  const [template, setTemplate] = useState<any | undefined>(() => undefined);
  const [title, setTitle] = useState('');
  const [photos, setPhotos] = useState<string[]>([]); // object URLs for previews (bulk)
  const filesRef = useRef<File[]>([]); // raw files for bulk upload
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  // new states for template pages and per-page user content
  const [templatePages, setTemplatePages] = useState<TemplatePage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const pageNumbers = templatePages.map((pg) => pg.page_number);


  const templatePay = template

  const { hasTemplateAccess, loading, openPaywall } =
    useTemplateAccess(templatePay)



  // userImages: map page_number -> (slotId -> url)
  const [userImages, setUserImages] = useState<Record<number, Record<string, string>>>({});

  // userTexts: map page_number -> (textId -> text)
  const [userTexts, setUserTexts] = useState<Record<number, Record<string, string>>>({});

  // for per-slot upload targeting
  const currentSlotTargetRef = useRef<{ pageNumber: number; slotId: string } | null>(null);

  // preview scale (renders pages smaller in the carousel)
  const PREVIEW_SCALE = 0.3;
  const PAGE_WIDTH = 1000;
  const PAGE_HEIGHT = 1415;

  useEffect(() => {
    let mounted = true;

    const fetchTemplateAndPages = async () => {
      setLoadingTemplate(true);

      // fetch template metadata
      const { data: tmpl, error: tErr } = await supabase
        .from('templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (tErr || !tmpl) {
        console.error('Error fetching template:', tErr);
        toast.error('Template not found');
        setLoadingTemplate(false);
        return;
      }

      // fetch template_pages ordered by page_number..
      const { data: pages, error: pErr } = await supabase
        .from('template_pages')
        .select('*')
        .eq('template_id', templateId)
        .order('page_number', { ascending: true });

      if (pErr) {
        console.error('Error fetching template pages:', pErr);
        toast.error('No template pages found');
        setLoadingTemplate(false);
        return;
      }

      if (!mounted) return;

      // initialize userTexts with defaults from layout_json
      const initialTexts: Record<number, Record<string, string>> = {};
      const initialImages: Record<number, Record<string, string>> = {};

      (pages || []).forEach((pg: any) => {
        const pn = pg.page_number;
        initialTexts[pn] = {};
        initialImages[pn] = {};

        const layout = pg.layout_json ?? {};
        (layout.textBlocks ?? []).forEach((tb: TextBlock) => {
          initialTexts[pn][tb.id] = tb.defaultText ?? '';
        });
        (layout.imageBlocks ?? []).forEach((ib: ImageBlock) => {
          // note: defaultImageUrl is not stored in userImages; userImages only contains user-supplied urls
          initialImages[pn][ib.id] = ''; // empty until user uploads or bulk assign
        });
      });

      setTemplate(tmpl);
      setTemplatePages(pages || []);
      setUserTexts(initialTexts);
      setUserImages(initialImages);
      setLoadingTemplate(false);
    };

    if (templateId) fetchTemplateAndPages();

    return () => {
      mounted = false;
    };
  }, [templateId]);

  if (loadingTemplate) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground">Loading template...</p>
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

  // Build background url for a page using your naming scheme::
  // template_pages/{Template_name}/{Page_index}.png
  const buildTemplatePageUrl = (templateSlug: string, pageIndex: number) => {
    const origin = `https://${(import.meta.env.VITE_SUPABASE_URL as string).replace(/^https?:\/\//, '')}`;
    return `${origin}/storage/v1/object/public/template_pages/${templateSlug}/${pageIndex}.png`;
  };

 

  // Bulk file select (unchanged UI)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasTemplateAccess) {
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
        filesRef.current.push(file); // store file for upload later
      }
    });

    // Do not exceed reasonable amount: template.required_photos + 50 (buffer)
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
    // remove matching file (we assume same index maps; safe enough for bulk)
    if (filesRef.current[index]) filesRef.current.splice(index, 1);
    setPhotos(newPhotos);
  };

  // Auto-assign uploaded images to template placeholders (sequential) BUT skip non-editable slots
  const applyNextImageToTemplate = (imageUrl: string) => {
    setUserImages((prev) => {
      const next = structuredClone(prev);

      for (const pg of templatePages) {
        const layout = pg.layout_json;
        if (!layout?.imageBlocks) continue;

        for (const ib of layout.imageBlocks) {
          if (ib.editable === false) continue;

          note: if (!next[pg.page_number]?.[ib.id]) {
            next[pg.page_number] ??= {};
            next[pg.page_number][ib.id] = imageUrl;
            return next;
          }
        }
      }

      return next; // no empty slots left
      
    });
  };


  // Upload all bulk files to storage and apply to placeholders
  const handleUploadAll = async () => {
    if (filesRef.current.length === 0) {
      toast.error('No photos selected to upload');
      return;
    }

    setIsGenerating(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

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

        const publicUrl =
          supabase.storage
            .from('magazine-assets')
            .getPublicUrl(data.path).data.publicUrl;

        // ✅ APPLY IMMEDIATELY
        applyNextImageToTemplate(publicUrl);

        uploadedCount++;

        // ✅ UPDATE TOAST
        toast.loading(
          `Uploading images… ${uploadedCount} of ${filesRef.current.length} uploaded`,
          { id: toastId }
        );
      }

      toast.success(
        `Images uploaded successfully (${uploadedCount}/${filesRef.current.length})`,
        { id: toastId }
      );

      filesRef.current = [];
      setPhotos([]);


    } catch (err) {
      console.error(err);
      toast.error('Something went wrong uploading images');
    } finally {
      setIsGenerating(false);
    }
  };

  // When editing inline text, update userTexts
  const handleTextChange = (pageNumber: number, textId: string, value: string) => {
    setUserTexts((prev) => {
      const copy = { ...prev };
      copy[pageNumber] = { ...(copy[pageNumber] || {}) };
      copy[pageNumber][textId] = value;
      return copy;
    });
  };

  // Open file picker to replace a single slot (set target then click hidden input)
  const handleReplaceSlotClick = (pageNumber: number, slotId: string) => {
    // check the slot is editable
    const pg = templatePages.find((p) => p.page_number === pageNumber);
    const ib = pg?.layout_json?.imageBlocks?.find((b: ImageBlock) => b.id === slotId);
    if (ib && ib.editable === false) {
      // do nothing for non-editable slot
      return;
    }

    if (!hasTemplateAccess) {
      openPaywall(); // from your guard
      return;
    }

    currentSlotTargetRef.current = { pageNumber, slotId };
    if (perSlotFileInputRef.current) perSlotFileInputRef.current.click();
  };

  // Handle single-slot file selection
  const handlePerSlotFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !currentSlotTargetRef.current) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    // double-check target is editable before uploading
    const target = currentSlotTargetRef.current;
    const pg = templatePages.find((p) => p.page_number === target.pageNumber);
    const ib = pg?.layout_json?.imageBlocks?.find((b: ImageBlock) => b.id === target.slotId);
    if (ib && ib.editable === false) {
      currentSlotTargetRef.current = null;
      if (perSlotFileInputRef.current) perSlotFileInputRef.current.value = '';
      return;
    }

    setIsGenerating(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error('Sign in required');
        setIsGenerating(false);
        return;
      }

      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('magazine-assets')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload image');
        setIsGenerating(false);
        return;
      }

      const url =
        supabase.storage.from('magazine-assets').getPublicUrl(uploadData.path).data?.publicUrl ??
        (uploadData?.publicUrl ?? '');

      setUserImages((prev) => {
        const copy = { ...prev };
        copy[target.pageNumber] = { ...(copy[target.pageNumber] || {}) };
        copy[target.pageNumber][target.slotId] = url;
        return copy;
      });

      toast.success('Image replaced');
    } catch (err) {
      console.error(err);
      toast.error('Failed to replace image');
    } finally {
      setIsGenerating(false);
      currentSlotTargetRef.current = null;
      if (perSlotFileInputRef.current) perSlotFileInputRef.current.value = '';
    }
  };

  // Generate/save: create magazines row, then magazine_pages rows with user_images & user_texts
  const handleGenerate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a magazine title');
      return;
    }

    setIsGenerating(true);

    try {
      // get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error('You must be signed in to generate a magazine');
        setIsGenerating(false);
        navigate('/auth?mode=login');
        return;
      }

      // create magazines row
      const { data: magData, error: magError } = await supabase
        .from('magazines')
        .insert([
          {
            owner: user.id,
            title: title,
            description: template.description ?? null,
            template_id: template.id,
            thumbnail_url: template.thumbnail_url ?? null,
            metadata: JSON.stringify({ createdFromTemplate: template.id }),
            is_published: false,
          },
        ])
        .select()
        .single();

      if (magError || !magData) {
        console.error('Error creating magazine:', magError);
        toast.error('Failed to create magazine');
        setIsGenerating(false);
        return;
      }

      // build inserts for magazine_pages based on templatePages order
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
      toast.error('Something went wrong while saving magazine');
    } finally {
      setIsGenerating(false);
    }
  };

  const progress = Math.min((photos.length / (template.required_photos ?? 1)) * 100, 100);

  // Carousel navigation helpers
  const goPrev = () => setCurrentPageIndex((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentPageIndex((i) => Math.min(templatePages.length - 1, i + 1));

  // Export pages to PDF (uses html2canvas + jspdf)
  // Requires: npm i html2canvas jspdf
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
      const SCALE = 1; // keep same as your current behavior

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

        // Clone node to avoid scaling issues
        const clone = original.cloneNode(true) as HTMLElement;

        // ✅ Workaround: html2canvas may ignore object-fit on <img>.
        // Convert each image-slot <img> into a background-image on the slot container for export.
        clone.querySelectorAll('[data-image-slot="true"]').forEach((slotEl) => {
          const slot = slotEl as HTMLElement;
          const img = slot.querySelector('img') as HTMLImageElement | null;
          if (!img || !img.src) return;

          slot.style.backgroundImage = `url(${img.src})`;
          slot.style.backgroundSize = 'cover';
          slot.style.backgroundPosition = 'center';
          slot.style.backgroundRepeat = 'no-repeat';

          // Hide img in export clone to prevent stretching
          img.style.display = 'none';
        });

        clone.style.width = `${PAGE_WIDTH}px`;
        clone.style.height = `${PAGE_HEIGHT}px`;
        clone.style.transform = 'none';
        clone.style.position = 'absolute';
        clone.style.left = '-99999px';
        clone.style.top = '0';

        // Remove UI-only elements (buttons, icons, etc.)
        clone.querySelectorAll('[data-ui="true"]').forEach((el) => el.remove());

        document.body.appendChild(clone);

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

      // ✅ Build filename from authenticated user + template
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'user';

      const safe = (s: string) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase();

      pdf.save(`${safe(userName)}_${safe(template.name)}_magazine.pdf`);

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
      toast.error('No pages to export')
      return
    }

    setIsGenerating(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error('Sign in required')
        return
      }

      const pageUrls = templatePages.map(
        (pg) =>
          document
            .getElementById(`page-${pg.page_number}`)
            ?.querySelector('img')?.src ||
          buildTemplatePageUrl(template.slug, pg.page_number)
      )

      const res = await fetch('/api/export-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: pageUrls,
          userName:
            user.user_metadata?.full_name ||
            user.email?.split('@')[0] ||
            'user',
          templateName: template.name,
          userId: user.id,
          templateId: template.id,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      // trigger download
      const a = document.createElement('a')
      a.href = data.url
      a.download = ''
      a.click()

      toast.success('Video exported successfully')
    } catch (err) {
      console.error(err)
      toast.error('Failed to export video')
    } finally {
      setIsGenerating(false)
    }
  }


  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Back Button.. */}
      <button
        onClick={() => navigate('/templates')}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Templates
      </button>

      {/* Header */}
      <div className="mb-6 animate-fade-in">
        <h1 className="text-editorial-md mb-2">Create Your {template.name} Magazine</h1>
        
        <p className="text-muted-foreground">
          {template.description}
        </p>

        <div className= "mt-3">
          <p className="text-muted-foreground font-semibold">
            {template.pageCount} pages • {template.requiredPhotos} photos required
          </p>
        </div>
      </div>

      {template?.price > 0 && !hasTemplateAccess && !loading && (
        <Card className="mb-6">
          <div className="p-6 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">This template is paid.</p>
              <p className="text-sm text-muted-foreground">
                Cost: ₦{Number(template.price).toLocaleString()}
              </p>
            </div>
            <Button variant="gold" onClick={openPaywall}>
              Unlock Template
            </Button>
          </div>
        </Card>
      )}


      {/* Template Pages Carousel... */}
      <div className="mb-6 relative">
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
                    {/* Render image placeholders.. */}
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
                            !isEditable && 'pointer-events-none' // ✅ allow click-through
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
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: 'center',
                                borderRadius: ib.borderRadius ? `${ib.borderRadius}px` : undefined,
                              }}
                            />
                          ) : (
                            <div className="text-xs text-muted-foreground text-center p-2">
                              {ib.editable === false ? 'Locked image' : 'Click to add image'}
                            </div>
                          )}

                          {ib.editable !== false && (
                            <button
                              data-ui="true"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReplaceSlotClick(pg.page_number, ib.id);
                              }}
                              className="absolute right-1 top-1 w-7 h-7 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-90"
                              title="Replace image"
                            >
                              <Image className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Render text placeholders (inline editable) */}
                    {(layout.textBlocks ?? []).map((tb: TextBlock) => {
                      const currentText = (userTexts[pg.page_number] || {})[tb.id] ?? tb.defaultText ?? '';
                      const isEditable = tb.editable !== false;

                      return (
                        <div
                          key={tb.id}
                          contentEditable={isEditable}
                          suppressContentEditableWarning
                          onBlur={(e: any) => {
                            if (!isEditable) return;
                            handleTextChange(pg.page_number, tb.id, e.currentTarget.textContent);
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
                            overflow: 'hidden',
                            zIndex: tb.zIndex ?? 2,
                            transform: `rotate(${tb.rotate ?? 0}deg)`,
                            fontWeight: tb.fontWeight ?? undefined,
                            fontFamily: tb.fontFamily ?? 'inherit',
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
      </div>

      {/* Details + Bulk Upload */}
    

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
            <label className="block text-sm font-medium mb-2">Upload Photos (bulk)</label>
            <p className="text-sm text-muted-foreground mb-3">
              Upload all your photos and we will apply them to the template automatically. You can adjust each page
              afterwards.
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
              onClick={() => bulkFileInputRef.current?.click()}
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
        </div>
      </Card>

    
 

      {/* Hidden per-slot file input... */}
      <input
        ref={(el) => (perSlotFileInputRef.current = el)}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePerSlotFileSelect}
      />

      {/* Save / Generate */}
      <div className="flex flex-wrap justify-end gap-3 mt-4">
        
          
        <PageDownloadDialog pageNumbers={pageNumbers} />

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPDF}
          disabled={isGenerating || templatePages.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
      </div>

    </div>
  );
}
