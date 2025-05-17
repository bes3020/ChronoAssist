
'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Brain, PlusCircle } from 'lucide-react';

interface GenerateOrAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateNew: () => void;
  onAddToExisting: () => void;
}

export function GenerateOrAddModal({ isOpen, onClose, onGenerateNew, onAddToExisting }: GenerateOrAddModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold flex items-center">
            <Brain className="mr-2 h-6 w-6 text-primary" />
            Timesheet AI Options
          </DialogTitle>
          <DialogDescription className="pt-2">
            How would you like to use the AI to process your notes?
          </DialogDescription>
        </DialogHeader>
        <div className="py-6 space-y-4">
          <Button
            onClick={() => {
              onGenerateNew();
              onClose();
            }}
            className="w-full justify-start text-left py-4 bg-background border border-primary hover:bg-primary/10"
          >
            <div className="flex items-center">
              <Brain className="mr-3 h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-primary-foreground">Generate New Entries</p>              
              </div>
            </div>
          </Button>
          <Button
            onClick={() => {
              onAddToExisting();
              onClose();
            }}
            className="w-full justify-start text-left py-4 bg-background border border-accent hover:bg-accent/10"
          >
            <div className="flex items-center">
             <PlusCircle className="mr-3 h-5 w-5 text-accent" />
              <div>
                <p className="font-semibold text-accent">Add to Existing Entries</p>                
              </div>
            </div>
          </Button>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

