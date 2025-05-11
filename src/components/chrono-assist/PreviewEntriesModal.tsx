
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

// Helper function to get unique string values for a field from historical data
const getUniqueFieldValues = (data: TimeEntry[], field: keyof Omit<TimeEntry, 'id' | 'Hours'>): string[] => {
  if (!data) return [];
  return Array.from(new Set(data.map(item => String(item[field])))).sort();
};


export function PreviewEntriesModal({ isOpen, onClose, entries, onSave, historicalData }: PreviewEntriesModalProps) {
  const [editableEntries, setEditableEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    setEditableEntries(JSON.parse(JSON.stringify(entries)));
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
              {editableEntries.map((entry) => {
                const projectOptions = useMemo(() => {
                  const options = [...uniqueProjects];
                  if (entry.Project && !options.includes(entry.Project)) {
                    options.push(entry.Project);
                    options.sort();
                  }
                  return options;
                }, [uniqueProjects, entry.Project]);

                const activityOptions = useMemo(() => {
                  if (!entry.Project) return [];
                  const filteredActivities = historicalData
                    .filter(item => item.Project === entry.Project)
                    .map(item => item.Activity);
                  const uniqueActivities = Array.from(new Set(filteredActivities));
                  if (entry.Activity && !uniqueActivities.includes(entry.Activity)) {
                    uniqueActivities.push(entry.Activity);
                  }
                  return uniqueActivities.sort();
                }, [historicalData, entry.Project, entry.Activity]);

                const workItemOptions = useMemo(() => {
                  if (!entry.Project || !entry.Activity) return [];
                  const filteredWorkItems = historicalData
                    .filter(item => item.Project === entry.Project && item.Activity === entry.Activity)
                    .map(item => item.WorkItem);
                  const uniqueWorkItems = Array.from(new Set(filteredWorkItems));
                  if (entry.WorkItem && !uniqueWorkItems.includes(entry.WorkItem)) {
                    uniqueWorkItems.push(entry.WorkItem);
                  }
                  return uniqueWorkItems.sort();
                }, [historicalData, entry.Project, entry.Activity, entry.WorkItem]);

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
                        value={entry.Project || ''}
                        onValueChange={(value) => handleChange(entry.id, 'Project', value)}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projectOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option || 'N/A'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={entry.Activity || ''}
                        onValueChange={(value) => handleChange(entry.id, 'Activity', value)}
                        disabled={!entry.Project}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select activity" />
                        </SelectTrigger>
                        <SelectContent>
                          {activityOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option || 'N/A'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={entry.WorkItem || ''}
                        onValueChange={(value) => handleChange(entry.id, 'WorkItem', value)}
                        disabled={!entry.Project || !entry.Activity}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select work item" />
                        </SelectTrigger>
                        <SelectContent>
                          {workItemOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option || 'N/A'}
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
                        className="text-sm w-24"
                        step="0.25"
                        min="0"
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

