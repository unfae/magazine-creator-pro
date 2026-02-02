import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Correct import
import { Label } from '@/components/ui/label';

interface BulkTextEditProps {
  textId: string;
  onBulkEdit: (id: string, value: string) => void;
}

export function BulkTextEdit({ textId, onBulkEdit }: BulkTextEditProps) {
  const [value, setValue] = useState('');

  const handleBulkEdit = () => {
    if (value.trim()) {
      onBulkEdit(textId, value);
      setValue('');
    }
  };

  return (
    <div className="p-2 border rounded mb-2">
      <Label htmlFor={textId}>Bulk Edit: {textId}</Label>
      <div className="flex gap-2 mt-1">
        <Input
          id={textId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Enter text for ${textId}`}
        />
        <Button onClick={handleBulkEdit} size="sm">
          Apply to All
        </Button>
      </div>
    </div>
  );
}
