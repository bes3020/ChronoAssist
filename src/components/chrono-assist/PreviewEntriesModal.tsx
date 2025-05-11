
'use client';

import type { ChangeEvent } from 'react';
import { useState, useEffect, useMemo } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';

interface PreviewEntriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: TimeEntry[];
  onSave: (updatedEntries: TimeEntry[]) => void;
  historicalData: TimeEntry[];
}

export function PreviewEntriesModal({ isOpen, onClose, entries, onSave, historicalData }: PreviewEntriesModalProps) {
  const [editableEntries, setEditableEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    setEditableEntries(JSON.parse(JSON.stringify(entries)));
  }, [entries, isOpen]);

  const getUniqueOptions = (field: keyof TimeEntry, currentValue: string): string[] => {
    const historicalValues = Array.from(new Set(historicalData.map(item => String(item[field]))));
    const options = [...historicalValues];
    if (currentValue && !options.includes(currentValue)) {
      options.push(currentValue);
    }
    return options.sort();
  };
  
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
        Date: new Date().toISOString().split('T')[0],
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
      <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] xl:max-w-[60vw] rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Preview Time Entries</DialogTitle>
          <DialogDescription>
            Review and edit the proposed time entries below. Project, Activity, and Work Item fields provide suggestions from historical data.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Work Item</TableHead>
                <TableHead className="w-[80px]">Hours</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead className="w-[50px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editableEntries.map((entry) => {
                const projectOptions = getUniqueOptions('Project', entry.Project);
                const activityOptions = getUniqueOptions('Activity', entry.Activity);
                const workItemOptions = getUniqueOptions('WorkItem', entry.WorkItem);
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Input
                        type="date"
                        value={entry.Date}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(entry.id, 'Date', e.target.value)}
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={entry.Project}
                        onValueChange={(value) => handleChange(entry.id, 'Project', value)}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projectOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={entry.Activity}
                        onValueChange={(value) => handleChange(entry.id, 'Activity', value)}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select activity" />
                        </SelectTrigger>
                        <SelectContent>
                          {activityOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={entry.WorkItem}
                        onValueChange={(value) => handleChange(entry.id, 'WorkItem', value)}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select work item" />
                        </SelectTrigger>
                        <SelectContent>
                          {workItemOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={entry.Hours}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(entry.id, 'Hours', parseFloat(e.target.value) || 0)}
                        className="text-sm w-20"
                        step="0.1"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={entry.Comment}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(entry.id, 'Comment', e.target.value)}
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveEntry(entry.id)}
                        aria-label="Remove entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
        <DialogFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-6">
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
