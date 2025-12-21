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

       // 1) High‑resolution render
        const scale = 3; // or 4 if you want even sharper (watch file size)
        const baseCanvas = await html2canvas(el, {
        scale,
        useCORS: true,
        // optional: explicitly set width/height if needed
        // width: el.clientWidth,
        // height: el.clientHeight,
        });

        // 2) Normalize to exact aspect ratio using a second canvas
        const targetWidth = baseCanvas.width;  // keeps aspect ratio from DOM
        const targetHeight = baseCanvas.height;

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
        ctx.drawImage(baseCanvas, 0, 0, targetWidth, targetHeight);
        }

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
