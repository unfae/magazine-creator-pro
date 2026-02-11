import { Card } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

export function TipsSection() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-5">
        <Sparkles className="h-5 w-5 text-gold" />
        <h3 className="text-lg font-medium">Tips to get the best from the magazine creator</h3>
      </div>

      <ul className="space-y-3 text-sm text-muted-foreground">
        <li className="flex items-start gap-3">
          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2" />
          <span>
            <strong className="font-medium">Use the samples as a guide:</strong> Check the sample texts and images to choose your own best‑fit photos and wording.
          </span>
        </li>

        <li className="flex items-start gap-3">
          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2" />
          <span>
            <strong className="font-medium">Review before exporting:</strong> After generating your magazine, take a moment to preview the pages before exporting to PDF or video.
          </span>
        </li>

        <li className="flex items-start gap-3">
          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2" />
          <span>
            <strong className="font-medium">Fill all text first:</strong> Type and apply all your text in the “Bulk Text Edit” section before uploading images, so you can focus on layout.
          </span>
        </li>

        <li className="flex items-start gap-3">
          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2" />
          <span>
            <strong className="font-medium">Upload many images at once:</strong> Upload several images in bulk first, then replace only the slots that need special photos.
          </span>
        </li>

        <li className="flex items-start gap-3">
          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2" />
          <span>
            <strong className="font-medium">Crop before uploading:</strong> If you need tight framing, crop your images first, then upload or replace them.
          </span>
        </li>

        <li className="flex items-start gap-3">
          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2" />
          <span>
            <strong className="font-medium">iPhone users – download one at a time:</strong> When downloading individual page images on iPhone, do it one after the other, since the browser doesn’t allow multiple downloads at once.
          </span>
        </li>
      </ul>
    </Card>
  );
}
