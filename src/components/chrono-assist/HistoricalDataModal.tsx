
'use client';

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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PlusCircle } from 'lucide-react'; // Icon for the new button

interface HistoricalDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  historicalData: TimeEntry[];
  onAddToShorthand: (shorthandLine: string) => void; // New prop
}

export function HistoricalDataModal({ isOpen, onClose, historicalData, onAddToShorthand }: HistoricalDataModalProps) {
  // if (!isOpen) return null; // Removed this line

  const handleAddClick = (entry: TimeEntry) => {
    // Construct the shorthand line. Users can edit the "value" part later.
    // Ensure project, activity, and workitem are not undefined or null
    const project = entry.Project || 'N/A';
    const activity = entry.Activity || 'N/A';
    const workItem = entry.WorkItem || 'N/A';
    const shorthandLine = `${project} - ${activity} - ${workItem} = `;
    onAddToShorthand(shorthandLine);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[80vw] xl:max-w-[80vw] rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Historical Time Entries</DialogTitle>
          <DialogDescription>
            View your past time entries. This data is used by the AI to provide suggestions.
            You can add an entry's Project-Activity-WorkItem combination to your shorthand.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          {historicalData.length > 0 ? (
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Work Item</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead className="w-[150px] text-center">Add to Shorthand</TableHead> 
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicalData.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.Date}</TableCell>
                    <TableCell>{entry.Project}</TableCell>
                    <TableCell>{entry.Activity}</TableCell>
                    <TableCell>{entry.WorkItem}</TableCell>
                    <TableCell>{entry.Comment}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddClick(entry)}
                        className="text-xs"
                        aria-label={`Add ${entry.Project} - ${entry.Activity} - ${entry.WorkItem} to shorthand`}
                      >
                        <PlusCircle className="mr-1 h-3 w-3" />
                        Add
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">No historical data available.</p>
          )}
        </ScrollArea>
        <DialogFooter className="pt-6">
          <Button onClick={onClose} className="bg-accent text-accent-foreground hover:bg-accent/90">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
