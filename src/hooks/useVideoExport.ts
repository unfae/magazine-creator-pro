import { useState } from 'react';
import { toast } from 'sonner';

export function useVideoExport() {
  const [isExportingVideo, setIsExportingVideo] = useState(false);

  const exportVideo = async (pageUrls: string[], template: any, userId: string) => {
    if (!pageUrls.length) {
      toast.error('No pages to export');
      return;
    }

    setIsExportingVideo(true);

    // Single toast for the whole flow
    const toastId = toast.loading('Preparing video export…', {
      position: 'top-left',
    });

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

      // Update toast: pages exported, video rendering
      toast.loading('Rendering video…', {
        id: toastId,
        position: 'top-left',
      });

      // Poll Shotstack until done
      await pollVideoStatus(data.statusUrl, data.renderId, toastId);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Video export failed', { id: toastId });
    } finally {
      setIsExportingVideo(false);
    }
  };

  const pollVideoStatus = async (statusUrl: string, renderId: string, toastId: string | number) => {
    const pollUrl = statusUrl; // already /stage/render/{id}

    const poll = async () => {
      try {
        const res = await fetch(pollUrl, {
          headers: {
            'x-api-key': process.env.NEXT_PUBLIC_SHOTSTACK_API_KEY || '', // or hard-code sandbox key if needed
          },
        });

        const data = await res.json();
        console.log('Poll status:', data);

        if (data.response?.status === 'done') {
          const videoUrl = data.response.url;

          toast.success('Video ready!', {
            id: toastId,
            action: {
              label: 'Open',
              onClick: () => {
                window.open(videoUrl, '_blank');
              },
            },
          });
          return;
        }

        if (data.response?.status === 'failed') {
          toast.error(`Video render failed: ${data.response.error || 'Unknown error'}`, {
            id: toastId,
          });
          return;
        }

        // Still processing
        setTimeout(poll, 4000);
      } catch (err) {
        console.error('Status poll failed:', err);
        setTimeout(poll, 4000);
      }
    };

    poll();
  };

  return { exportVideo, isExportingVideo };
}
