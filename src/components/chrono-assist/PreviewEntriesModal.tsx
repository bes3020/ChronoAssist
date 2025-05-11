'use client';

import type { ChangeEvent } from 'react';
import { useState, useEffect } from 'react';
import type { TimeEntry } from '@/types/time-entry';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2 } from 'lucide-react';

interface PreviewEntriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: TimeEntry[];
  onSave: (updatedEntries: TimeEntry[]) => void;
}

export function PreviewEntriesModal({ isOpen, onClose, entries, onSave }: PreviewEntriesModalProps) {
  const [editableEntries, setEditableEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    // Deep copy entries to avoid mutating the original prop
    setEditableEntries(JSON.parse(JSON.stringify(entries)));
  }, [entries, isOpen]); // Reset when entries change or modal reopens

  const handleChange = (id: string, field: keyof TimeEntry, value: string | number) => {
    setEditableEntries(prev =>
      prev.map(entry =>
        entry.id === id ? { ...entry, [field]: field === 'Hours' ? Number(value) : value } : entry
      )
    );
  };

  const handleAddEntry = () => {
    const newEntryId = `new_${Date.now()}_${editableEntries.length}`;
    setEditableEntries(prev => [
      ...prev,
      {
        id: newEntryId,
        Date: new Date().toISOString().split('T')[0], // Default to today
        Project: '',
        Activity: '',
        WorkItem: '',
        Hours: 0,
        Comment: '',
      },
    ]);
  };

  const handleRemoveEntry = (id: string) => {
    setEditableEntries(prev => prev.filter(entry => entry.id !== id));
  };

  const handleSaveChanges = () => {
    onSave(editableEntries);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90vw] md:max-w-[70vw] lg:max-w-[60vw] xl:max-w-[50vw] rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Preview Time Entries</DialogTitle>
          <DialogDescription>
            Review and edit the proposed time entries below.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] p-1 pr-4">
          <div className="grid gap-6 py-4">
            {editableEntries.map((entry, index) => (
              <div key={entry.id} className="p-4 border rounded-md shadow-sm bg-card relative">
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemoveEntry(entry.id)}
                    aria-label="Remove entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                <h3 className="text-lg font-medium mb-3 text-primary">Entry {index + 1}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`date-${entry.id}`} className="text-sm font-medium">Date</Label>
                    <Input
                      id={`date-${entry.id}`}
                      type="date"
                      value={entry.Date}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(entry.id, 'Date', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`hours-${entry.id}`} className="text-sm font-medium">Hours</Label>
                    <Input
                      id={`hours-${entry.id}`}
                      type="number"
                      value={entry.Hours}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(entry.id, 'Hours', parseFloat(e.target.value) || 0)}
                      className="mt-1"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`project-${entry.id}`} className="text-sm font-medium">Project</Label>
                    <Input
                      id={`project-${entry.id}`}
                      value={entry.Project}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(entry.id, 'Project', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`activity-${entry.id}`} className="text-sm font-medium">Activity</Label>
                    <Input
                      id={`activity-${entry.id}`}
                      value={entry.Activity}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(entry.id, 'Activity', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor={`workItem-${entry.id}`} className="text-sm font-medium">Work Item</Label>
                    <Input
                      id={`workItem-${entry.id}`}
                      value={entry.WorkItem}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(entry.id, 'WorkItem', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor={`comment-${entry.id}`} className="text-sm font-medium">Comment</Label>
                    <Input
                      id={`comment-${entry.id}`}
                      value={entry.Comment}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(entry.id, 'Comment', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4">
            <Button variant="outline" onClick={handleAddEntry}>
              Add New Entry
            </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSaveChanges} className="bg-accent text-accent-foreground hover:bg-accent/90">
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
