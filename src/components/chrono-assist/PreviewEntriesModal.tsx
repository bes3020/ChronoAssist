
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
import { EditableEntryRow } from './EditableEntryRow';

interface PreviewEntriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: TimeEntry[];
  onSave: (updatedEntries: TimeEntry[]) => void;
  historicalData: TimeEntry[];
}

// Helper function to get unique string values for a field from historical data
const getUniqueFieldValues = (data: TimeEntry[], field: keyof Omit<TimeEntry, 'id' | 'Hours'>): string[] => {
  if (!data) return [];
  return Array.from(new Set(data.map(item => String(item[field])))).sort();
};


export function PreviewEntriesModal({ isOpen, onClose, entries, onSave, historicalData }: PreviewEntriesModalProps) {
  const [editableEntries, setEditableEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    // Deep copy to avoid mutating original entries
    setEditableEntries(entries.map(entry => ({ ...entry })));
  }, [entries, isOpen]);
  
  const uniqueProjects = useMemo(() => getUniqueFieldValues(historicalData, 'Project'), [historicalData]);

  const handleChange = (id: string, field: keyof TimeEntry, value: string | number) => {
    setEditableEntries(prev =>
      prev.map(entry => {
        if (entry.id !== id) return entry;

        const updatedEntry = { ...entry, [field]: field === 'Hours' ? Number(value) : String(value) };

        if (field === 'Project') {
          const newProject = String(value);
          // Check if current Activity is valid for the new Project
          const activitiesForNewProject = Array.from(new Set(historicalData
            .filter(item => item.Project === newProject)
            .map(item => item.Activity)));
          
          if (!activitiesForNewProject.includes(updatedEntry.Activity)) {
            updatedEntry.Activity = ''; // Reset Activity
          }
          
          // Consequentially, WorkItem might also need reset if Activity was reset or if current WorkItem is not valid
          const workItemsForNewProjectAndActivity = Array.from(new Set(historicalData
            .filter(item => item.Project === newProject && item.Activity === updatedEntry.Activity)
            .map(item => item.WorkItem)));

          if (!workItemsForNewProjectAndActivity.includes(updatedEntry.WorkItem)) {
            updatedEntry.WorkItem = ''; // Reset WorkItem
          }
        } else if (field === 'Activity') {
          const newActivity = String(value);
          // Check if current WorkItem is valid for current Project and new Activity
           const workItemsForCurrentProjectAndNewActivity = Array.from(new Set(historicalData
            .filter(item => item.Project === updatedEntry.Project && item.Activity === newActivity)
            .map(item => item.WorkItem)));
          
          if (!workItemsForCurrentProjectAndNewActivity.includes(updatedEntry.WorkItem)) {
            updatedEntry.WorkItem = ''; // Reset WorkItem
          }
        }
        return updatedEntry;
      })
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
      <DialogContent className="sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[80vw] xl:max-w-[70vw] rounded-lg shadow-xl">
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
                <TableHead className="w-[100px]">Hours</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead className="w-[50px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editableEntries.map((entry) => (
                <EditableEntryRow
                  key={entry.id}
                  entry={entry}
                  historicalData={historicalData}
                  uniqueProjects={uniqueProjects}
                  onChange={handleChange}
                  onRemove={handleRemoveEntry}
                />
              ))}
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
