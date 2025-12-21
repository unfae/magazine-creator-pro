// src/hooks/usePageImageDownload.ts
import { useState } from 'react';
import type html2canvasType from 'html2canvas';

export function usePageImageDownload() {
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [downloading, setDownloading] = useState(false);

  const togglePage = (pageNumber: number) => {
    setSelectedPages((prev) =>
      prev.includes(pageNumber)
        ? prev.filter((n) => n !== pageNumber)
        : [...prev, pageNumber]
    );
  };

  const clearSelection = () => setSelectedPages([]);

  const downloadSelected = async () => {
    if (selectedPages.length === 0) return;

    setDownloading(true);
    try {
      const html2canvas: typeof html2canvasType = (await import('html2canvas')).default;

      const pages = [...selectedPages].sort((a, b) => a - b);

      for (const pageNumber of pages) {
        const el = document.getElementById(`page-${pageNumber}`);
        if (!el) continue;

        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
        });

        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `magazine-page-${pageNumber}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // small delay between downloads so browsers don't treat it as spam
        await new Promise((r) => setTimeout(r, 400));
      }
    } finally {
      setDownloading(false);
    }
  };

  return {
    selectedPages,
    downloading,
    togglePage,
    clearSelection,
    downloadSelected,
  };
}
