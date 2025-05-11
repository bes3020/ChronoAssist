
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

interface HistoricalDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  historicalData: TimeEntry[];
}

export function HistoricalDataModal({ isOpen, onClose, historicalData }: HistoricalDataModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] xl:max-w-[60vw] rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Historical Time Entries</DialogTitle>
          <DialogDescription>
            View your past time entries. This data is used by the AI to provide suggestions.
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
                  <TableHead className="w-[80px]">Hours</TableHead>
                  <TableHead>Comment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicalData.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.Date}</TableCell>
                    <TableCell>{entry.Project}</TableCell>
                    <TableCell>{entry.Activity}</TableCell>
                    <TableCell>{entry.WorkItem}</TableCell>
                    <TableCell>{entry.Hours.toFixed(1)}</TableCell>
                    <TableCell>{entry.Comment}</TableCell>
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
