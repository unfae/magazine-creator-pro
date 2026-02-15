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
    // Shotstack status endpoint (GET /{renderId})
    const pollUrl = `https://api.shotstack.io/stage/render/${renderId}`;
    
    const poll = async () => {
        try {
        const res = await fetch(pollUrl, {
            headers: {
            'x-api-key': 'MwuTPl8lVltu14HCnLVwGGAJHiBLAVeST54dkwhB'
            }
        });
        
        const data = await res.json();
        
        console.log('Poll status:', data); // DEBUG
        
        if (data.response?.status === 'done') {
            const videoUrl = data.response.url;
            toast.success('✅ Video Ready!', {
            action: {
                label: 'Download',
                onClick: () => {
                window.open(videoUrl, '_blank');
                }
            }
            });
            return;
        }
        
        if (data.response?.status === 'failed') {
            toast.error('Render failed (check images URLs)');
            return;
        }
        
        // Still processing
        setTimeout(poll, 4000);
        
        } catch (err) {
        console.error('Poll error:', err);
        }
    };
    
    poll();
    };


  return { 
    exportVideo, 
    isExportingVideo 
  };
}
