
'use client';

import type { ChangeEvent } from 'react';
import { useMemo } from 'react';
import type { TimeEntry } from '@/types/time-entry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TableCell,
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

interface EditableEntryRowProps {
  entry: TimeEntry;
  historicalData: TimeEntry[];
  uniqueProjects: string[];
  onChange: (id: string, field: keyof TimeEntry, value: string | number) => void;
  onRemove: (id: string) => void;
}

export function EditableEntryRow({ entry, historicalData, uniqueProjects, onChange, onRemove }: EditableEntryRowProps) {
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
    <TableRow>
      <TableCell>
        <Input
          type="date"
          value={entry.Date}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(entry.id, 'Date', e.target.value)}
          className="text-sm"
        />
      </TableCell>
      <TableCell>
        <Select
          value={entry.Project || ''}
          onValueChange={(value) => onChange(entry.id, 'Project', value)}
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
          onValueChange={(value) => onChange(entry.id, 'Activity', value)}
          disabled={!entry.Project || activityOptions.length === 0}
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
          onValueChange={(value) => onChange(entry.id, 'WorkItem', value)}
          disabled={!entry.Project || !entry.Activity || workItemOptions.length === 0}
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
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(entry.id, 'Hours', parseFloat(e.target.value) || 0)}
          className="text-sm w-24"
          step="0.25"
          min="0"
        />
      </TableCell>
      <TableCell>
        <Input
          value={entry.Comment}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(entry.id, 'Comment', e.target.value)}
          className="text-sm"
        />
      </TableCell>
      <TableCell className="text-center">
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10"
          onClick={() => onRemove(entry.id)}
          aria-label="Remove entry"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
