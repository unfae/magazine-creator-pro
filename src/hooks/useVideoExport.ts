import { useState } from 'react';
import { toast } from 'sonner';

export function useVideoExport() {
  const [isExportingVideo, setIsExportingVideo] = useState(false);

  const exportVideo = async (pageUrls: string[], template: any, userId: string) => {
    if (pageUrls.length === 0) {
      toast.error('No pages to export');
      return;
    }

    setIsExportingVideo(true);

    try {
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
      
      // Auto-poll status until ready
      pollVideoStatus(data.statusUrl, data.renderId);
      
    } catch (err: any) {
      console.error('Video export error:', err);
      toast.error(err.message || 'Video export failed');
    } finally {
      setIsExportingVideo(false);
    }
  };

  const pollVideoStatus = async (statusUrl: string, renderId: string) => {

    const pollUrl = statusUrl.replace('/sandbox/render', '/stage/render');

    const poll = async () => {
      try {
        const res = await fetch(statusUrl, {
          headers: {
            'x-api-key': 'MwuTPl8lVltu14HCnLVwGGAJHiBLAVeST54dkwhB',
          },
        });
        
        if (!res.ok) {
          console.error('Status check failed');
          return;
        }
        
        const data = await res.json();
        
        if (data.response?.status === 'done') {
          const videoUrl = data.response.url;
          toast.success('Video ready!', {
            action: {
              label: 'Download MP4',
              onClick: () => {
                const a = document.createElement('a');
                a.href = videoUrl;
                a.download = `magazine-${renderId}.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              },
            },
          });
          return;
        }
        
        if (data.response?.status === 'failed') {
          toast.error('Video render failed');
          return;
        }
        
        // Still processing - poll again in 3s
        setTimeout(poll, 3000);
      } catch (err) {
        console.error('Status poll failed:', err);
      }
    };
    
    poll();
  };

  return { 
    exportVideo, 
    isExportingVideo 
  };
}
