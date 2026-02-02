import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BulkTextEditProps {
  textIds: string[];
  onBulkEdit: (values: Record<string, string>) => void;
}

export function BulkTextEdit({ textIds, onBulkEdit }: BulkTextEditProps) {
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
      <p className="text-sm text-muted-foreground mb-2">
        Enter your details here once to apply in all places and manually edit if needed.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
        {textIds.map(id => (
          <Input
            key={id}
            value={values[id] || ''}
            onChange={(e) => handleChange(id, e.target.value)}
            placeholder={`Enter text for ${id}`}
            className="w-full"
          />
        ))}
      </div>
      <Button onClick={handleApplyAll} size="sm" className="mt-2">
        Apply to All
      </Button>
    </div>
  );
}
