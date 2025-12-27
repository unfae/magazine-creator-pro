// src/components/PageDownloadDialog.tsx
import React from 'react';
import { usePageImageDownload } from '@/hooks/usePageImageDownload';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { logTemplateExport } from '@/lib/exportLog';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';

type PageDownloadDialogProps = {
  pageNumbers: number[];
  templateId: string;
  templateName: string;
  triggerLabel?: string;
};


export function PageDownloadDialog({
  pageNumbers,
  templateId,
  templateName,
  triggerLabel = 'Download as Images',
}: PageDownloadDialogProps) {
  const {
    selectedPages,
    downloading,
    togglePage,
    clearSelection,
    downloadSelected,
    setSelectedPages,
  } = usePageImageDownload();

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);


  const [open, setOpen] = React.useState(false);

  if (pageNumbers.length === 0) return null;

  const handleSelectAll = () => {
    setSelectedPages(pageNumbers);
  };

  const handleDownloadAll = async () => {
    setSelectedPages(pageNumbers);
    await downloadSelected();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await logTemplateExport({
        userId: user.id,
        userEmail: user.email,
        userName: user.user_metadata?.full_name,
        templateId,
        templateName,
        exportType: 'images',
        pageCount: pageNumbers.length,
        meta: { pages: pageNumbers, mode: 'all' },
      });
    }
  };


  const handleConfirm = async () => {
  await downloadSelected();

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await logTemplateExport({
      userId: user.id,
      userEmail: user.email,
      userName: user.user_metadata?.full_name,
      templateId,
      templateName,
      exportType: 'images',
      pageCount: selectedPages.length,
      meta: { pages: selectedPages, mode: 'selected' },
    });
  }
};


  const selectedCount = selectedPages.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gold" size="sm" className="whitespace-nowrap" >
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select pages to download</DialogTitle>
          <DialogDescription>
            Choose which pages you want to save as high-quality images. Each selected page
            will be downloaded as a separate JPG file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <p className="text-xs text-muted-foreground">
                Tap pages to select or deselect.
              </p>

              {isIOS && (
                <p className="text-xs text-muted-foreground">
                  iPhone/iPad only allows one page to downlaod at a time.
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Currently selected: {selectedCount} / {pageNumbers.length}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {!isIOS && (
                <button type="button" onClick={handleSelectAll} className="underline">
                  Select all
                </button>
              )}

              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 max-h-52 overflow-auto">
            {pageNumbers.map((n) => {
              const isSelected = selectedPages.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    if (isIOS) {
                      setSelectedPages([n]);   // force single selection on iOS
                    } else {
                      togglePage(n);
                    }
                  }}

                  className={[
                    'px-2 py-1 text-xs rounded border transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-accent',
                  ].join(' ')}
                >
                  Page {n}
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter className="mt-4 flex flex-row justify-between gap-2 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>

          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              disabled={downloading || pageNumbers.length === 0}
            >
              {downloading ? 'Downloading…' : 'Download all pages'}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={downloading || selectedCount === 0}
            >
              {downloading
                ? 'Downloading…'
                : selectedCount === 0
                ? 'Download selected'
                : `Download ${selectedCount} page(s)`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
