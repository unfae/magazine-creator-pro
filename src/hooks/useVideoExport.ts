import { useState } from 'react';
import { toast } from 'sonner';

export function useVideoExport() {
  const [isExportingVideo, setIsExportingVideo] = useState(false);

  const exportVideo = async (templatePages: any[], template: any, userId: string) => {
    if (templatePages.length === 0) {
      toast.error('No pages to export');
      return;
    }

    setIsExportingVideo(true);

    try {
      // Extract page image URLs (SAME logic as your PDF export!)
      const pageUrls: string[] = templatePages.map((pg: any) => {
        const pageElement = document.getElementById(`page-${pg.pagenumber}`);
        const img = pageElement?.querySelector('img') as HTMLImageElement;
        return img?.src || '';
      }).filter(Boolean);

      if (pageUrls.length === 0) {
        throw new Error('No valid page images found');
      }

      const res = await fetch('/api/export-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: pageUrls,
          userId,
          templateName: template.name,
          templateId: template.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Export failed');

      toast.success('Video rendering started! (3-10s)');
      
      // Auto-poll status
      pollVideoStatus(data.statusUrl, data.renderId);
      
    } catch (err: any) {
      console.error('Video export error:', err);
      toast.error(err.message || 'Video export failed');
    } finally {
      setIsExportingVideo(false);
    }
  };

  const pollVideoStatus = async (statusUrl: string, renderId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(statusUrl, {
          headers: {
            'x-api-key': 'MwuTPl8lVltu14HCnLVwGGAJHiBLAVeST54dkwhB', // Your key for client-side polling
          },
        });
        
        if (!res.ok) {
          console.error('Status check failed');
          return;
        }
        
        const data = await res.json();
        
        if (data.response?.status === 'done') {
          const videoUrl = data.response.url;
          toast.success(`Video ready!`, {
            action: {
              label: 'Download',
              onClick: () => {
                const a = document.createElement('a');
                a.href = videoUrl;
                a.download = `magazine-video-${renderId}.mp4`;
                a.click();
              },
            },
          });
          return;
        }
        
        if (data.response?.status === 'failed') {
          toast.error('Video render failed');
          return;
        }
        
        // Still processing - poll again
        setTimeout(poll, 3000);
      } catch (err) {
        console.error('Status poll failed:', err);
      }
    };
    
    // Start polling
    poll();
  };

  return { 
    exportVideo, 
    isExportingVideo 
  };
}
