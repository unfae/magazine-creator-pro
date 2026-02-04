import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TextBlock {
  id: string;
  defaultText: string;
}

interface BulkTextEditProps {
  textBlocks: TextBlock[];
  onBulkEdit: (values: Record<string, string>) => void;
}

export function BulkTextEdit({ textBlocks, onBulkEdit }: BulkTextEditProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleChange = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const handleApplyAll = () => {
    onBulkEdit(values);
  };

  return (
    <div className="p-2 border rounded mb-2">
      <Label>Enter your details.</Label>
      <p className="text-sm text-muted-foreground mb-2">
        Enter your details here once to apply in all places and manually edit if needed.
      </p>

      <div className="relative">
        {/* Always visible scrollbar + compact height */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-4"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'hsl(var(--muted-foreground) / 0.3) transparent',
          }}
        >
          {textBlocks.map((tb, i) => (
            <div key={tb.id} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-6 text-right select-none">
                {i + 1}
              </span>
              <div className="flex-1">
                <Input
                  value={values[tb.id] || ''}
                  onChange={(e) => handleChange(tb.id, e.target.value)}
                  placeholder={`Enter your ${tb.id} (e.g., ${tb.defaultText})`}
                  className="w-full"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Visible scroll hint (text) */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-end pr-2 pointer-events-none"
          style={{
            opacity: textBlocks.length > 6 ? 0.6 : 0,
            transition: 'opacity 0.2s ease',
          }}
        >
          <span className="text-xs text-muted-foreground select-none">scroll</span>
        </div>
      </div>

      <Button onClick={handleApplyAll} size="sm" className="mt-2">
        Apply to All
      </Button>
    </div>
  );
}
