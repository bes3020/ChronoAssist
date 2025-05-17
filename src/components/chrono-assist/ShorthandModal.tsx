
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ShorthandModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentShorthand: string;
  onSave: (shorthand: string) => void; // This will call the server action via TimeEntryForm
}

export function ShorthandModal({ isOpen, onClose, currentShorthand, onSave }: ShorthandModalProps) {
  const [shorthand, setShorthand] = useState(currentShorthand);

  useEffect(() => {
    if (isOpen) {
      setShorthand(currentShorthand);
    }
  }, [isOpen, currentShorthand]);

  const handleSave = () => {
    onSave(shorthand); // Call the prop which should trigger server action
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] xl:max-w-[70vw] rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">My Shorthand / Abbreviations</DialogTitle>
          <DialogDescription>
            Define your common shorthand or abbreviations here. This will help the AI better understand your notes.
            For example: "KB = Knowledge Base", "CR = Code Review". Enter one per line.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <Label htmlFor="shorthand-textarea" className="text-sm font-medium">
            Your Shorthand Notes
          </Label>
          <Textarea
            id="shorthand-textarea"
            value={shorthand}
            onChange={(e) => setShorthand(e.target.value)}
            placeholder="e.g., PM = Project Manager&#10;UI dev = User Interface development"
            rows={30}
            className="text-sm p-3 rounded-md shadow-inner focus:ring-accent focus:border-accent"
          />
        </div>
        <DialogFooter className="pt-6">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">
            Save Shorthand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
