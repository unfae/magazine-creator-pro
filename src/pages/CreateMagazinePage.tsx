import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Upload, X, Image, ArrowLeft, Sparkles, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

type TextBlock = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  defaultText?: string;
  fontSize?: number;
  color?: string;
  align?: string;
};

type ImageBlock = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type TemplatePage = {
  id: string;
  template_id: string;
  page_number: number;
  page_image_url: string;
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

  // kept names
  const [template, setTemplate] = useState<any | undefined>(() => undefined);
  const [title, setTitle] = useState('');
  const [photos, setPhotos] = useState<string[]>([]); // object URLs for previews (bulk)
  const filesRef = useRef<File[]>([]); // raw files for bulk upload
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  // new states for template pages and per-page user content
  const [templatePages, setTemplatePages] = useState<TemplatePage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  // userImages: array indexed by page_number, each is record imageBlockId->url
  const [userImages, setUserImages] = useState<Record<number, Record<string, string>>>({});
  // userTexts: array indexed by page_number, each is record textBlockId->text
  const [userTexts, setUserTexts] = useState<Record<number, Record<string, string>>>({});

  // for per-slot upload targeting
  const currentSlotTargetRef = useRef<{ pageNumber: number; slotId: string } | null>(null);

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

      // fetch template_pages ordered by page_number
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
        // image blocks start empty until user uploads or bulk assignment
        (layout.imageBlocks ?? []).forEach((ib: ImageBlock) => {
          initialImages[pn][ib.id] = '';
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

  // Build background url for a page using your naming scheme:
  // template_pages/{Template_name}/{Page_index}.png
  // assume template.slug is sanitized and unique
  const buildTemplatePageUrl = (templateSlug: string, pageIndex: number) => {
    const base = `${supabase.storage.from('template_pages').getPublicUrl('').data?.publicUrl ?? ''}`;
    // getPublicUrl requires path; for stable building, use the known public URL structure
    // but to be robust, we'll build the common path format:
    const origin = `https://${import.meta.env.VITE_SUPABASE_URL?.replace(/^https?:\/\//, '')}`;
    // Public object path:
    return `${origin}/storage/v1/object/public/template_pages/${templateSlug}/${pageIndex}.png`;
  };

  // Bulk file select (unchanged UI)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos: string[] = [];
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        newPhotos.push(url);
        filesRef.current.push(file); // store file for upload later
      }
    });

    // Do not exceed reasonable amount: template.required_photos + 20 (buffer)
    if (photos.length + newPhotos.length > (template.required_photos ?? 0) + 20) {
      toast.error(`Maximum ${(template.required_photos ?? 0) + 20} photos allowed`);
      newPhotos.forEach(u => URL.revokeObjectURL(u));
      filesRef.current.splice(filesRef.current.length - newPhotos.length, newPhotos.length);
      return;
    }

    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    URL.revokeObjectURL(newPhotos[index]);
    newPhotos.splice(index, 1);
    // remove matching file (we assume same index maps; safe enough for bulk)
    if (filesRef.current[index]) filesRef.current.splice(index, 1);
    setPhotos(newPhotos);
  };

  // Auto-assign uploaded images to template placeholders (sequential)
  const applyBulkImagesToPages = (uploadedUrls: string[]) => {
    // flatten all imageSlots across pages into a list of {pageNumber, slotId}
    const slots: { pageNumber: number; slotId: string }[] = [];
    templatePages.forEach((pg) => {
      const layout = pg.layout_json ?? {};
      (layout.imageBlocks ?? []).forEach((ib: ImageBlock) => {
        slots.push({ pageNumber: pg.page_number, slotId: ib.id });
      });
    });

    // assign in order; if fewer images than slots, fill until images exhausted
    const newUserImages = { ...userImages };
    let imgIndex = 0;
    for (let s = 0; s < slots.length && imgIndex < uploadedUrls.length; s++) {
      const slot = slots[s];
      newUserImages[slot.pageNumber] = newUserImages[slot.pageNumber] || {};
      newUserImages[slot.pageNumber][slot.slotId] = uploadedUrls[imgIndex];
      imgIndex++;
    }

    setUserImages(newUserImages);
    toast.success('Images applied to template pages. You can adjust them individually.');
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
        navigate('/auth');
        return;
      }

      const uploadedUrls: string[] = [];

      for (let i = 0; i < filesRef.current.length; i++) {
        const file = filesRef.current[i];
        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage
          .from('magazine-assets')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (error) {
          console.error('Upload error:', error);
          toast.error('Failed to upload images');
          setIsGenerating(false);
          return;
        }

        // get public url
        const publicUrl = supabase.storage.from('magazine-assets').getPublicUrl(data.path).data?.publicUrl
          ?? (data?.publicUrl ?? null);

        uploadedUrls.push(publicUrl ?? '');
      }

      // apply to pages
      applyBulkImagesToPages(uploadedUrls);

      // clear local previews and filesRef (we keep photos UI for preview but clear filesRef to prevent reupload on save)
      filesRef.current = [];
      setPhotos([]); // optional: remove previews
      toast.success('All photos uploaded and applied.');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong uploading images');
    } finally {
      setIsGenerating(false);
    }
  };

  // When editing inline text, update userTexts
  const handleTextChange = (pageNumber: number, textId: string, value: string) => {
    setUserTexts(prev => {
      const copy = { ...prev };
      copy[pageNumber] = { ...(copy[pageNumber] || {}) };
      copy[pageNumber][textId] = value;
      return copy;
    });
  };

  // Open file picker to replace a single slot (set target then click hidden input)
  const handleReplaceSlotClick = (pageNumber: number, slotId: string) => {
    currentSlotTargetRef.current = { pageNumber, slotId };
    if (perSlotFileInputRef.current) perSlotFileInputRef.current.click();
  };

  // Handle single-slot file selection
  const handlePerSlotFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !currentSlotTargetRef.current) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;

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

      const url = supabase.storage.from('magazine-assets').getPublicUrl(uploadData.path).data?.publicUrl
        ?? (uploadData?.publicUrl ?? '');

      const target = currentSlotTargetRef.current;
      setUserImages(prev => {
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
        navigate('/auth');
        return;
      }

      // create magazines row
      const { data: magData, error: magError } = await supabase
        .from('magazines')
        .insert([{
          owner: user.id,
          title: title,
          description: template.description ?? null,
          template_id: template.id,
          thumbnail_url: template.thumbnail_url ?? null,
          metadata: JSON.stringify({ createdFromTemplate: template.id }),
          is_published: false
        }])
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

      const { error: pagesError } = await supabase
        .from('magazine_pages')
        .insert(pageInserts);

      if (pagesError) {
        console.error('Error inserting magazine pages:', pagesError);
        toast.error('Failed to save magazine pages');
        setIsGenerating(false);
        return;
      }

      toast.success('Magazine saved as draft successfully!');
      // optionally navigate to magazine editor or magazines list
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Back Button */}
      <button
        onClick={() => navigate('/templates')}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Templates
      </button>

      {/* Header */}
      <div className="mb-6 animate-fade-in">
        <h1 className="text-editorial-md mb-2">Create with {template.name}</h1>
        <p className="text-muted-foreground">
          {template.page_count} pages • {template.required_photos} photos required
        </p>
      </div>

      {/* Template Pages Carousel */}
      <div className="mb-6 relative">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground">Preview pages (click to edit)</div>
          <div className="flex gap-2">
            <button onClick={goPrev} className="p-2 rounded-md border"><ChevronLeft /></button>
            <button onClick={goNext} className="p-2 rounded-md border"><ChevronRight /></button>
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <div className="flex gap-6" style={{ width: `${templatePages.length * 100}%` }}>
            {templatePages.map((pg, idx) => {
              const layout = pg.layout_json ?? {};
              const bgUrl = pg.page_image_url
                || buildTemplatePageUrl(template.slug, pg.page_number);

              return (
                <div
                  key={pg.id}
                  className={cn(
                    'relative rounded-lg overflow-hidden flex-shrink-0',
                    'bg-border'
                  )}
                  style={{
                    width: 1000 * 0.3, // scaled preview (50% of full width)
                    height: 1415 * 0.3,
                    backgroundImage: `url(${bgUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                  onClick={() => setCurrentPageIndex(idx)}
                >
                  {/* Render image placeholders */}
                  {(layout.imageBlocks ?? []).map((ib: ImageBlock) => {
                    const slotUrl =
                      (userImages[pg.page_number] || {})[ib.id] || '';

                    const scale = 0.5;

                    return (
                      <div
                        key={ib.id}
                        className="absolute overflow-hidden rounded-sm bg-gray-100/30 flex items-center justify-center cursor-pointer"
                        style={{
                          left: ib.x * scale,
                          top: ib.y * scale,
                          width: ib.width * scale,
                          height: ib.height * scale,
                          zIndex: ib.zIndex ?? 1, // ← NEW
                        }}
                        onClick={() => handleReplaceSlotClick(pg.page_number, ib.id)}
                      >
                        {slotUrl ? (
                          <img
                            src={slotUrl}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-xs text-muted-foreground text-center p-2">
                            Click to add image
                          </div>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReplaceSlotClick(pg.page_number, ib.id);
                          }}
                          className="absolute right-1 top-1 w-7 h-7 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-90"
                        >
                          <Image className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}


                  {/* Render text placeholders (inline editable) */}
                  {(layout.textBlocks ?? []).map((tb: TextBlock) => {
                    const scale = 0.5;
                    const currentText =
                      (userTexts[pg.page_number] || {})[tb.id] ??
                      tb.defaultText ??
                      '';

                    return (
                      <div
                        key={tb.id}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e: any) =>
                          handleTextChange(
                            pg.page_number,
                            tb.id,
                            e.currentTarget.textContent
                          )
                        }
                        className="absolute outline-none"
                        style={{
                          left: tb.x * scale,
                          top: tb.y * scale,
                          width: tb.width * scale,
                          height: tb.height * scale,
                          fontSize: (tb.fontSize ?? 16) * scale,
                          color: tb.color ?? 'inherit',
                          textAlign: tb.align as any,
                          overflow: 'hidden',
                          zIndex: tb.zIndex ?? 2, // ← NEW
                        }}
                      >
                        {currentText}
                      </div>
                    );
                  })}

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
              placeholder="e.g., Summer Memories 2024"
              className="max-w-md"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Upload Photos (bulk)</label>
            <p className="text-sm text-muted-foreground mb-3">
              Upload all your photos and we will apply them to the template automatically. You can adjust each page afterwards.
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
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
                photos.length === 0 ? "border-border" : "border-gold/30"
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
              <Button variant="outline" onClick={() => { filesRef.current = []; setPhotos([]); }}>
                Clear
              </Button>
              <Button variant="gold" onClick={handleUploadAll} disabled={isGenerating || filesRef.current.length === 0}>
                Upload & Apply
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Hidden per-slot file input */}
      <input
        ref={(el) => (perSlotFileInputRef.current = el)}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePerSlotFileSelect}
      />

      {/* Save / Generate */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate('/templates')}>
          Cancel
        </Button>
        <Button
          variant="gold"
          size="lg"
          onClick={handleGenerate}
          disabled={isGenerating || !title.trim()}
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Save Draft
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
