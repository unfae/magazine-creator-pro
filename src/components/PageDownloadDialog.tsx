// src/components/PageDownloadDialog.tsx
import React from 'react';
import { usePageImageDownload } from '@/hooks/usePageImageDownload';
import { Button } from '@/components/ui/button';
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
  triggerLabel?: string;
};

export function PageDownloadDialog({
  pageNumbers,
  triggerLabel = 'Download pages as images',
}: PageDownloadDialogProps) {
  const {
    selectedPages,
    downloading,
    togglePage,
    clearSelection,
    downloadSelected,
  } = usePageImageDownload();

  const [open, setOpen] = React.useState(false);

  const handleConfirm = async () => {
    await downloadSelected();
    // optional: keep dialog open; or close after download
    // setOpen(false);
  };

  if (pageNumbers.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select pages to download</DialogTitle>
          <DialogDescription>
            Choose which pages you want to save as images. Each selected page
            will be downloaded as a separate JPG file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Tap pages to select or deselect.
            </p>
            {selectedPages.length > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 max-h-52 overflow-auto">
            {pageNumbers.map((n) => {
              const isSelected = selectedPages.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => togglePage(n)}
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

        <DialogFooter className="mt-4 flex flex-row justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={downloading || selectedPages.length === 0}
          >
            {downloading
              ? 'Downloading…'
              : selectedPages.length === 0
              ? 'Select pages'
              : `Download ${selectedPages.length} page(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
