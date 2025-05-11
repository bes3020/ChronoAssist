'use client';

import { useState, useTransition } from 'react';
import type { TimeEntry } from '@/types/time-entry';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { PreviewEntriesModal } from './PreviewEntriesModal';
import { getProposedEntriesAction, submitTimeEntriesAction, getHistoricalDataAction } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, ListChecks, History, Send } from 'lucide-react';

export function TimeEntryForm() {
  const [notes, setNotes] = useState('');
  const [proposedEntries, setProposedEntries] = useState<TimeEntry[]>([]);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  
  const [isPendingPreview, startTransitionPreview] = useTransition();
  const [isPendingSubmit, startTransitionSubmit] = useTransition();
  const [isPendingHistorical, startTransitionHistorical] = useTransition();

  const { toast } = useToast();

  const isLoading = isPendingPreview || isPendingSubmit || isPendingHistorical;

  const handlePreviewEntries = () => {
    if (!notes.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter some notes before previewing entries.",
        variant: "destructive",
      });
      return;
    }
    startTransitionPreview(async () => {
      try {
        const entries = await getProposedEntriesAction(notes);
        if (entries.length === 0 && notes.trim() !== "") {
           toast({
            title: "No Suggestions",
            description: "AI could not generate suggestions. Try adding more details or check historical data.",
          });
        }
        setProposedEntries(entries);
        setIsPreviewModalOpen(true);
      } catch (error) {
        toast({
          title: "Error",
          description: (error as Error).message || "Failed to preview entries.",
          variant: "destructive",
        });
      }
    });
  };

  const handleSubmitTime = () => {
    if (proposedEntries.length === 0) {
      toast({
        title: "No Entries",
        description: "There are no entries to submit. Preview entries first.",
        variant: "destructive",
      });
      return;
    }
    startTransitionSubmit(async () => {
      try {
        const result = await submitTimeEntriesAction(proposedEntries);
        toast({
          title: result.success ? "Success" : "Error",
          description: result.message,
          variant: result.success ? "default" : "destructive",
        });
      } catch (error) {
         toast({
          title: "Submission Failed",
          description: (error as Error).message || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    });
  };

  const handleGetHistorical = () => {
    startTransitionHistorical(async () => {
      try {
        const result = await getHistoricalDataAction();
         toast({
          title: result.success ? "Success" : "Error",
          description: result.message,
          variant: result.success ? "default" : "destructive",
        });
        // Potentially update local state with result.data if needed for UI
      } catch (error) {
        toast({
          title: "Failed to Get Historical Data",
          description: (error as Error).message || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    });
  };

  const handleSaveModalEntries = (updatedEntries: TimeEntry[]) => {
    setProposedEntries(updatedEntries);
    toast({
      title: "Entries Updated",
      description: "Your changes to the time entries have been saved locally.",
    });
  };
  
  const progressValue = isLoading ? undefined : 0; // Indeterminate if loading, 0 otherwise

  return (
    <Card className="w-full shadow-xl rounded-lg">
      <CardHeader>
        <CardTitle className="text-3xl font-bold flex items-center gap-2">
          <Lightbulb className="w-8 h-8 text-primary" />
          AI Time Entry Assistant
        </CardTitle>
        <CardDescription className="text-md">
          Enter your work notes below. The AI will help suggest time entries based on historical data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Textarea
            placeholder="Describe your work, e.g., 'Worked on Project Alpha login feature, attended Beta sprint planning meeting...'"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            className="text-base p-4 rounded-md shadow-inner focus:ring-accent focus:border-accent"
            disabled={isLoading}
          />
        </div>
        {isLoading && (
          <div className="pt-2">
            <Progress value={progressValue} className="w-full h-2 [&>div]:bg-accent" />
            <p className="text-sm text-accent text-center mt-2 animate-pulse">Processing your request...</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-between gap-4 pt-6">
        <Button 
          onClick={handleGetHistorical} 
          disabled={isLoading} 
          variant="outline" 
          className="w-full sm:w-auto"
        >
          <History className="mr-2 h-5 w-5" /> Get Historical Data
        </Button>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Button 
            onClick={handlePreviewEntries} 
            disabled={isLoading || !notes.trim()} 
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <ListChecks className="mr-2 h-5 w-5" /> Preview Entries
          </Button>
          <Button 
            onClick={handleSubmitTime} 
            disabled={isLoading || proposedEntries.length === 0} 
            className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Send className="mr-2 h-5 w-5" /> Submit Time
          </Button>
        </div>
      </CardFooter>

      <PreviewEntriesModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        entries={proposedEntries}
        onSave={handleSaveModalEntries}
      />
    </Card>
  );
}
