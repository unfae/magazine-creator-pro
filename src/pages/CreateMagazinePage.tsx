import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Upload, X, Image, ArrowLeft, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';

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
  editable?: boolean;
  rotate?: number;
  zIndex?: number;
};

type ImageBlock = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  editable?: boolean;
  defaultImageUrl?: string;
  rotate?: number;
  zIndex?: number;
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

  const [template, setTemplate] = useState<any>();
  const [title, setTitle] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const filesRef = useRef<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  const [templatePages, setTemplatePages] = useState<TemplatePage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [userImages, setUserImages] = useState<Record<number, Record<string, string>>>({});
  const [userTexts, setUserTexts] = useState<Record<number, Record<string, string>>>({});

  const currentSlotTargetRef = useRef<{ pageNumber: number; slotId: string } | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchTemplateAndPages = async () => {
      setLoadingTemplate(true);

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
    return () => { mounted = false; };
  }, [templateId]);

  if (loadingTemplate) return <div className="container mx-auto px-4 py-12 text-center"><p className="text-muted-foreground">Loading template...</p></div>;
  if (!template) return (
    <div className="container mx-auto px-4 py-12 text-center">
      <h1 className="text-2xl font-serif mb-4">Template not found</h1>
      <Button variant="outline" onClick={() => navigate('/templates')}>Back to Templates</Button>
    </div>
  );

  const buildTemplatePageUrl = (templateSlug: string, pageIndex: number) => {
    const origin = `https://${import.meta.env.VITE_SUPABASE_URL?.replace(/^https?:\/\//, '')}`;
    return `${origin}/storage/v1/object/public/template_pages/${templateSlug}/${pageIndex}.png`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos: string[] = [];
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        newPhotos.push(url);
        filesRef.current.push(file);
      }
    });

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
    if (filesRef.current[index]) filesRef.current.splice(index, 1);
    setPhotos(newPhotos);
  };

  const applyBulkImagesToPages = (uploadedUrls: string[]) => {
    const slots: { pageNumber: number; slotId: string }[] = [];
    templatePages.forEach(pg => {
      const layout = pg.layout_json ?? {};
      (layout.imageBlocks ?? []).forEach(ib => {
        if (ib.editable !== false) slots.push({ pageNumber: pg.page_number, slotId: ib.id });
      });
    });

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

  const handleUploadAll = async () => {
    if (filesRef.current.length === 0) { toast.error('No photos selected'); return; }
    setIsGenerating(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { toast.error('Sign in required'); setIsGenerating(false); navigate('/auth'); return; }

      const uploadedUrls: string[] = [];
      for (let i = 0; i < filesRef.current.length; i++) {
        const file = filesRef.current[i];
        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage.from('magazine-assets').upload(filePath, file, { cacheControl: '3600', upsert: false });
        if (error) { console.error(error); toast.error('Upload failed'); setIsGenerating(false); return; }
        const publicUrl = supabase.storage.from('magazine-assets').getPublicUrl(data.path).data?.publicUrl ?? '';
        uploadedUrls.push(publicUrl);
      }

      applyBulkImagesToPages(uploadedUrls);
      filesRef.current = [];
      setPhotos([]);
    } catch (err) { console.error(err); toast.error('Upload failed'); }
    finally { setIsGenerating(false); }
  };

  const handleTextChange = (pageNumber: number, textId: string, value: string) => {
    setUserTexts(prev => { const copy = { ...prev }; copy[pageNumber] = { ...(copy[pageNumber] || {}) }; copy[pageNumber][textId] = value; return copy; });
  };

  const handleReplaceSlotClick = (pageNumber: number, slotId: string) => {
    const block = templatePages.find(pg => pg.page_number === pageNumber)?.layout_json.imageBlocks?.find(b => b.id === slotId);
    if (!block || block.editable === false) return; // no interaction for non-editable
    currentSlotTargetRef.current = { pageNumber, slotId };
    perSlotFileInputRef.current?.click();
  };

  const handlePerSlotFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !currentSlotTargetRef.current) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    setIsGenerating(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { toast.error('Sign in required'); setIsGenerating(false); return; }

      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('magazine-assets').upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) { console.error(uploadError); toast.error('Upload failed'); setIsGenerating(false); return; }

      const url = supabase.storage.from('magazine-assets').getPublicUrl(uploadData.path).data?.publicUrl ?? '';
      const target = currentSlotTargetRef.current;
      setUserImages(prev => { const copy = { ...prev }; copy[target.pageNumber] = { ...(copy[target.pageNumber] || {}) }; copy[target.pageNumber][target.slotId] = url; return copy; });
      toast.success('Image replaced');
    } catch (err) { console.error(err); toast.error('Failed to replace image'); }
    finally { setIsGenerating(false); currentSlotTargetRef.current = null; if (perSlotFileInputRef.current) perSlotFileInputRef.current.value = ''; }
  };

  const handleGenerate = async () => {
    if (!title.trim()) { toast.error('Enter a magazine title'); return; }
    setIsGenerating(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { toast.error('Sign in required'); setIsGenerating(false); navigate('/auth'); return; }

      const { data: magData, error: magError } = await supabase.from('magazines').insert([{
        owner: user.id,
        title: title,
        description: template.description ?? null,
        template_id: template.id,
        thumbnail_url: template.thumbnail_url ?? null,
        metadata: JSON.stringify({ createdFromTemplate: template.id }),
        is_published: false
      }]).select().single();
      if (magError || !magData) { console.error(magError); toast.error('Failed to create magazine'); setIsGenerating(false); return; }

      const pageInserts = templatePages.map(pg => ({
        magazine_id: magData.id,
        template_id: template.id,
        page_number: pg.page_number,
        user_images: userImages[pg.page_number] ?? {},
        user_texts: userTexts[pg.page_number] ?? {},
      }));

      const { error: pagesError } = await supabase.from('magazine_pages').insert(pageInserts);
      if (pagesError) { console.error(pagesError); toast.error('Failed to save pages'); setIsGenerating(false); return; }

      toast.success('Magazine saved as draft!');
      navigate('/magazines');
    } catch (err) { console.error(err); toast.error('Failed to save magazine'); }
    finally { setIsGenerating(false); }
  };

  const goPrev = () => setCurrentPageIndex(i => Math.max(0, i - 1));
  const goNext = () => setCurrentPageIndex(i => Math.min(templatePages.length - 1, i + 1));

  const exportPdf = async () => {
    if (!templatePages.length) return;
    const pdf = new jsPDF({ unit: 'px', format: [1415, 1000] }); // full size page dimensions
    for (let i = 0; i < templatePages.length; i++) {
      const pg = templatePages[i];
      const layout = pg.layout_json ?? {};
      const bgUrl = pg.page_image_url ?? buildTemplatePageUrl(template.slug, pg.page_number);

      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1415;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const img = await new Promise<HTMLImageElement>((res) => {
        const iEl = new Image();
        iEl.crossOrigin = 'anonymous';
        iEl.src = bgUrl;
        iEl.onload = () => res(iEl);
      });
      ctx.drawImage(img, 0, 0, 1000, 1415);

      // Draw images
      (layout.imageBlocks ?? []).forEach(ib => {
        const url = (userImages[pg.page_number] || {})[ib.id] || ib.defaultImageUrl;
        if (!url) return;
        const imgEl = new Image();
        imgEl.crossOrigin = 'anonymous';
        imgEl.src = url;
        imgEl.onload = () => {
          ctx.drawImage(imgEl, ib.x, ib.y, ib.width, ib.height);
        };
      });

      // Draw text
      (layout.textBlocks ?? []).forEach(tb => {
        const text = (userTexts[pg.page_number] || {})[tb.id] || tb.defaultText || '';
        ctx.font = `${tb.fontSize ?? 16}px sans-serif`;
        ctx.fillStyle = tb.color ?? '#000';
        ctx.textAlign = (tb.align as CanvasTextAlign) || 'left';
        ctx.fillText(text, tb.x, tb.y + (tb.fontSize ?? 16));
      });

      // Wait a tick to ensure images drawn
      await new Promise(r => setTimeout(r, 50));

      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 1000, 1415);
    }
    pdf.save(`${title || 'magazine'}.pdf`);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <button onClick={() => navigate('/templates')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Templates
      </button>

      <div className="mb-6 animate-fade-in">
        <h1 className="text-editorial-md mb-2">Create with {template.name}</h1>
        <p className="text-muted-foreground">{template.page_count} pages • {template.required_photos} photos required</p>
      </div>

      {/* Template carousel */}
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
              const bgUrl = pg.page_image_url ?? buildTemplatePageUrl(template.slug, pg.page_number);
              const scale = 0.5;

              return (
                <div
                  key={pg.id}
                  className="relative rounded-lg overflow-hidden flex-shrink-0 bg-border"
                  style={{
                    width: 1000 * scale,
                    height: 1415 * scale,
                    backgroundImage: `url(${bgUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                  onClick={() => setCurrentPageIndex(idx)}
                >
                  {/* Images */}
                  {(layout.imageBlocks ?? []).map(ib => {
                    const slotUrl = (userImages[pg.page_number] || {})[ib.id] || ib.defaultImageUrl || '';
                    return (
                      <div
                        key={ib.id}
                        className={cn(
                          'absolute overflow-hidden rounded-sm bg-gray-100/30 flex items-center justify-center',
                          ib.editable !== false ? 'cursor-pointer' : ''
                        )}
                        style={{
                          left: ib.x * scale,
                          top: ib.y * scale,
                          width: ib.width * scale,
                          height: ib.height * scale,
                          zIndex: ib.zIndex ?? 1,
                          transform: `rotate(${ib.rotate ?? 0}deg)`,
                        }}
                        onClick={() => handleReplaceSlotClick(pg.page_number, ib.id)}
                      >
                        {slotUrl && <img src={slotUrl} className="w-full h-full object-cover" />}
                        {ib.editable !== false && (
                          <button
                            onClick={e => { e.stopPropagation(); handleReplaceSlotClick(pg.page_number, ib.id); }}
                            className="absolute right-1 top-1 w-7 h-7 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-90"
                          >
                            <Image className="h-4 w-4" />
                          </button>
                        )}
                        {!slotUrl && ib.editable !== false && <div className="text-xs text-muted-foreground text-center p-2">Click to add image</div>}
                      </div>
                    );
                  })}

                  {/* Texts */}
                  {(layout.textBlocks ?? []).map(tb => {
                    const currentText = (userTexts[pg.page_number] || {})[tb.id] ?? tb.defaultText ?? '';
                    return (
                      <div
                        key={tb.id}
                        contentEditable={tb.editable !== false}
                        suppressContentEditableWarning
                        onBlur={e => tb.editable !== false && handleTextChange(pg.page_number, tb.id, e.currentTarget.textContent || '')}
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
                          zIndex: tb.zIndex ?? 2,
                          transform: `rotate(${tb.rotate ?? 0}deg)`,
                          cursor: tb.editable === false ? 'default' : 'text',
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

      {/* Bulk upload & title */}
      <Card className="mb-6">
        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Magazine Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Summer Memories 2024" className="max-w-md" />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Upload Photos (bulk)</label>
            <p className="text-sm text-muted-foreground mb-3">Upload all your photos and we will apply them automatically.</p>

            <input ref={bulkFileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
            <div onClick={() => bulkFileInputRef.current?.click()} className={cn("border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all", photos.length === 0 ? "border-border" : "border-gold/30")}>
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
                    <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-foreground/80 text-background flex items-center justify-center">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <Button variant="outline" onClick={() => { filesRef.current = []; setPhotos([]); }}>Clear</Button>
              <Button variant="gold" onClick={handleUploadAll} disabled={isGenerating || filesRef.current.length === 0}>Upload & Apply</Button>
            </div>
          </div>
        </div>
      </Card>

      <input ref={el => perSlotFileInputRef.current = el} type="file" accept="image/*" className="hidden" onChange={handlePerSlotFileSelect} />

      {/* Save / Export */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate('/templates')}>Cancel</Button>
        <Button variant="gold" size="lg" onClick={handleGenerate} disabled={isGenerating || !title.trim()}>
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-background/30 border-t-background rounded-full animate-spin" /> Saving...
            </span>
          ) : (
            <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Save Draft</span>
          )}
        </Button>
        <Button variant="outline" size="lg" onClick={exportPdf}>Export PDF</Button>
      </div>
    </div>
  );
}
