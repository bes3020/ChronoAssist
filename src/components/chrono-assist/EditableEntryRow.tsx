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
  uniqueProjects: string[]; // Assumed to be pre-filtered for non-empty strings by the parent
  onChange: (id: string, field: keyof TimeEntry, value: string | number) => void;
  onRemove: (id: string) => void;
}

export function EditableEntryRow({ entry, historicalData, uniqueProjects, onChange, onRemove }: EditableEntryRowProps) {
  const projectOptions = useMemo(() => {
    const options = [...uniqueProjects]; // uniqueProjects is already filtered for non-empty strings
    // If current entry.Project is non-empty and not in the filtered options, add it
    if (entry.Project && entry.Project !== '' && !options.includes(entry.Project)) {
      options.push(entry.Project);
      options.sort();
    }
    return options;
  }, [uniqueProjects, entry.Project]);

  const activityOptions = useMemo(() => {
    if (!entry.Project) return [];
    // Get activities for the current project, filter out empty strings for SelectItem values
    const filteredActivities = historicalData
      .filter(item => item.Project === entry.Project)
      .map(item => item.Activity)
      .filter(activity => activity !== ''); // Ensure options for SelectItem are non-empty
    const uniqueActivities = Array.from(new Set(filteredActivities));
    // Add current non-empty Activity if it's not in the list
    if (entry.Activity && entry.Activity !== '' && !uniqueActivities.includes(entry.Activity)) {
      uniqueActivities.push(entry.Activity);
    }
    return uniqueActivities.sort();
  }, [historicalData, entry.Project, entry.Activity]);

  const workItemOptions = useMemo(() => {
    if (!entry.Project || !entry.Activity) return [];
    // Get work items for the current project/activity, filter out empty strings for SelectItem values
    const filteredWorkItems = historicalData
      .filter(item => item.Project === entry.Project && item.Activity === entry.Activity)
      .map(item => item.WorkItem)
      .filter(workItem => workItem !== ''); // Ensure options for SelectItem are non-empty
    const uniqueWorkItems = Array.from(new Set(filteredWorkItems));
    // Add current non-empty WorkItem if it's not in the list
    if (entry.WorkItem && entry.WorkItem !== '' && !uniqueWorkItems.includes(entry.WorkItem)) {
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
          value={entry.Project || ''} // If entry.Project is '', SelectValue will show placeholder
          onValueChange={(value) => onChange(entry.id, 'Project', value)}
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projectOptions.map((option) => (
              <SelectItem key={option} value={option}> {/* option is guaranteed non-empty */}
                {option} {/* Display text can be the option itself */}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={entry.Activity || ''} // If entry.Activity is '', SelectValue will show placeholder
          onValueChange={(value) => onChange(entry.id, 'Activity', value)}
          disabled={!entry.Project} // Activity selection enabled if Project is selected
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Select activity" />
          </SelectTrigger>
          <SelectContent>
            {activityOptions.map((option) => (
              <SelectItem key={option} value={option}> {/* option is guaranteed non-empty */}
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={entry.WorkItem || ''} // If entry.WorkItem is '', SelectValue will show placeholder
          onValueChange={(value) => onChange(entry.id, 'WorkItem', value)}
          disabled={!entry.Project || !entry.Activity} // WorkItem selection enabled if Project and Activity are selected
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Select work item" />
          </SelectTrigger>
          <SelectContent>
            {workItemOptions.map((option) => (
              <SelectItem key={option} value={option}> {/* option is guaranteed non-empty */}
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
