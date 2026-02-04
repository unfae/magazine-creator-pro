import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TextBlock {
  id: string;
  defaultText?: string;
}

interface BulkTextEditProps {
  textIds: string[];
  textBlocks?: TextBlock[];
  onBulkEdit: (values: Record<string, string>) => void;
}

export function BulkTextEdit({ textIds, textBlocks, onBulkEdit }: BulkTextEditProps) {
  const safeTextBlocks =
    Array.isArray(textBlocks) && textBlocks.length > 0
      ? textBlocks
      : Array.isArray(textIds)
      ? textIds.map(id => ({
          id,
          defaultText: id, // fallback
        }))
      : [];

  const [values, setValues] = useState<Record<string, string>>({});

  const handleChange = (id: string, value: string) => {
    setValues(prev => ({ ...prev, [id]: value }));
  };

  const handleApplyAll = () => {
    onBulkEdit(values);
  };

  return (
    <div className="p-2 border rounded mb-2">
      <Label>Enter your details.</Label>
      <p className="text-sm text-muted-foreground mb-1">
        Enter your details here once to apply in all places and manually edit if needed.
      </p>
      <p className="text-sm text-muted-foreground mb-2">
        You can scroll within this container to see all fields.
      </p>

      <div className="relative">
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-42 overflow-y-auto pr-4"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'hsl(var(--primary)) hsl(var(--muted))',
          }}
        >
          {safeTextBlocks.map((tb, i) => {
            const hasDefaultText = tb.defaultText && tb.defaultText !== tb.id;
            const placeholder = hasDefaultText
              ? `Enter your ${tb.id} (e.g., ${tb.defaultText})`
              : `Enter your ${tb.id}`;

            return (
              <div key={tb.id} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6 text-right select-none">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <Input
                    value={values[tb.id] || ''}
                    onChange={e => handleChange(tb.id, e.target.value)}
                    placeholder={placeholder}
                    className="w-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Button onClick={handleApplyAll} size="sm" className="mt-2">
        Apply to All
      </Button>
    </div>
  );
}
