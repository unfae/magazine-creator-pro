import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Upload, X, Image, ArrowLeft, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function CreateMagazinePage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // keep the same var name 'template'
  const [template, setTemplate] = useState<any | undefined>(() => undefined);
  const [title, setTitle] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  // keep an array of File objects for upload
  const filesRef = useRef<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchTemplate = async () => {
      setLoadingTemplate(true);
      const { data: tmpl, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) {
        console.error('Error fetching template:', error);
        toast.error('Template not found');
        setLoadingTemplate(false);
        return;
      }

      if (!mounted) return;
      setTemplate(tmpl);
      setLoadingTemplate(false);
    };

    if (templateId) fetchTemplate();

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

    if (photos.length + newPhotos.length > template.required_photos + 5) {
      toast.error(`Maximum ${template.required_photos + 5} photos allowed`);
      // revoke the object URLs we just created for safety
      newPhotos.forEach(u => URL.revokeObjectURL(u));
      // also remove the pushed files (pop them)
      filesRef.current.splice(filesRef.current.length - newPhotos.length, newPhotos.length);
      return;
    }

    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    URL.revokeObjectURL(newPhotos[index]);
    newPhotos.splice(index, 1);
    // also remove the corresponding File if it exists
    if (filesRef.current[index]) {
      filesRef.current.splice(index, 1);
    }
    setPhotos(newPhotos);
  };

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a magazine title');
      return;
    }
    if (photos.length < template.required_photos) {
      toast.error(`Please upload at least ${template.required_photos} photos`);
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

      // Upload filesRef.current to Supabase Storage
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

        // get public url (assumes bucket is public)
        const { publicUrl } = supabase.storage.from('magazine-assets').getPublicUrl(data.path);
        // new SDK returns { data: { publicUrl } } in some versions — we guard both
        const url = (publicUrl ?? (data?.publicUrl ?? null)) as string | null;
        uploadedUrls.push(url ?? '');
      }

      // Insert into magazines table
      const { data: magData, error: magError } = await supabase
        .from('magazines')
        .insert([{
          owner: user.id,
          title: title,
          description: template.description ?? null,
          template_id: template.id,
          thumbnail_url: uploadedUrls[0] ?? null,
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

      // Insert pages into magazine_pages table
      const pageInserts = uploadedUrls.map((url, idx) => ({
        magazine_id: magData.id,
        page_number: idx + 1,
        content: { type: 'image', src: url }
      }));

      const { error: pagesError } = await supabase
        .from('magazine_pages')
        .insert(pageInserts);

      if (pagesError) {
        console.error('Error inserting pages:', pagesError);
        toast.error('Failed to save magazine pages');
        setIsGenerating(false);
        return;
      }

      toast.success('Magazine generated successfully!');
      // clear local object URLs and files
      photos.forEach(p => URL.revokeObjectURL(p));
      filesRef.current = [];
      setPhotos([]);
      setTitle('');
      navigate('/magazines');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong while generating magazine');
    } finally {
      setIsGenerating(false);
    }
  };

  const progress = Math.min((photos.length / template.required_photos) * 100, 100);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back Button */}
      <button
        onClick={() => navigate('/templates')}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Templates
      </button>

      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-editorial-md mb-2">Create with {template.name}</h1>
        <p className="text-muted-foreground">
          Upload {template.required_photos} photos to generate your {template.page_count}-page magazine
        </p>
      </div>

      {/* Template Preview */}
      <Card className="mb-8 overflow-hidden">
        <div className="flex flex-col md:flex-row">
          <div className="md:w-1/3">
            <img
              src={template.thumbnail_url}
              alt={template.name}
              className="w-full h-48 md:h-full object-cover"
            />
          </div>
          <div className="p-6 flex-1">
            <span className="text-xs font-medium px-2 py-1 bg-secondary rounded-full text-secondary-foreground">
              {template.category}
            </span>
            <h3 className="font-serif text-xl mt-3 mb-2">{template.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{template.description}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{template.page_count} pages</span>
              <span>•</span>
              <span>{template.required_photos} photos required</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Magazine Title */}
      <div className="mb-8">
        <label className="block text-sm font-medium mb-2">Magazine Title</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Summer Memories 2024"
          className="max-w-md"
        />
      </div>

      {/* Photo Upload */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="block text-sm font-medium">Upload Photos</label>
            <p className="text-sm text-muted-foreground">
              {photos.length} of {template.required_photos} required photos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-gold transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            {photos.length >= template.required_photos && (
              <Check className="h-4 w-4 text-gold" />
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Upload Area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all",
            "hover:border-gold hover:bg-gold/5",
            photos.length === 0 ? "border-border" : "border-gold/30"
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Click to upload photos</p>
              <p className="text-sm text-muted-foreground">or drag and drop</p>
            </div>
          </div>
        </div>

        {/* Photo Grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mt-6">
            {photos.map((photo, index) => (
              <div key={index} className="relative aspect-square group rounded-lg overflow-hidden">
                <img
                  src={photo}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-gold flex items-center justify-center transition-colors"
            >
              <Image className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate('/templates')}>
          Cancel
        </Button>
        <Button 
          variant="gold" 
          size="lg"
          onClick={handleGenerate}
          disabled={isGenerating || photos.length < template.required_photos || !title.trim()}
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              Generating...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Generate Magazine
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
