import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// Fields whose defaultText is >= this length get a 2-row textarea instead of an input.
const LONG_FIELD_THRESHOLD = 60;

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
      ? textIds.map(id => ({ id, defaultText: id }))
      : [];

  const [values, setValues] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState(false);

  const handleChange = (id: string, value: string) =>
    setValues(prev => ({ ...prev, [id]: value }));

  const handleApplyAll = () => {
    onBulkEdit(values);
    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
  };

  // Split blocks into short (single-line) and long (paragraph) fields.
  // Short fields sit in a 3-col grid; long fields each span the full width below.
  const shortBlocks = safeTextBlocks.filter(
    tb => (tb.defaultText?.length ?? 0) < LONG_FIELD_THRESHOLD
  );
  const longBlocks = safeTextBlocks.filter(
    tb => (tb.defaultText?.length ?? 0) >= LONG_FIELD_THRESHOLD
  );

  const allBlocks = safeTextBlocks; // keep original order for numbering

  return (
    <div className="p-3 border rounded mb-2 space-y-3">
      <div>
        <Label>Enter your details</Label>
        <p className="text-sm text-muted-foreground mt-0.5">
          Fill in once to apply everywhere — you can still edit individual fields afterwards.
        </p>
      </div>

      {/* ── Short fields — 3-col grid, single-line inputs ─────────────────── */}
      {shortBlocks.length > 0 && (
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--primary)) hsl(var(--muted))' }}
        >
          {shortBlocks.map(tb => {
            const num = allBlocks.indexOf(tb) + 1;
            const placeholder =
              tb.defaultText && tb.defaultText !== tb.id
                ? `Type ${tb.id} (e.g., ${tb.defaultText})`
                : `Type ${tb.id}`;

            return (
              <div key={tb.id} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5 text-right shrink-0 select-none">
                  {num}
                </span>
                <Input
                  value={values[tb.id] || ''}
                  onChange={e => handleChange(tb.id, e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 text-sm"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Long fields — full-width, fixed 2-row textarea ────────────────── */}
      {longBlocks.length > 0 && (
        <div className="space-y-2">
          {longBlocks.map(tb => {
            const num = allBlocks.indexOf(tb) + 1;
            const placeholder =
              tb.defaultText && tb.defaultText !== tb.id
                ? `Type ${tb.id} (e.g., ${tb.defaultText})`
                : `Type ${tb.id}`;

            return (
              <div key={tb.id} className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground w-5 text-right shrink-0 select-none mt-2.5">
                  {num}
                </span>
                <div className="flex-1">
                  <textarea
                    rows={2}
                    value={values[tb.id] || ''}
                    onChange={e => handleChange(tb.id, e.target.value)}
                    placeholder={placeholder}
                    className={cn(
                      'w-full resize-none rounded-md border border-input bg-background px-3 py-2',
                      'text-sm placeholder:text-muted-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button type="button" onClick={handleApplyAll} size="sm"
        className={applied ? 'bg-green-600 hover:bg-green-600 text-white border-green-600' : ''}>
        {applied ? 'Text Applied ✓' : 'Apply to All'}
      </Button>
    </div>
  );
}