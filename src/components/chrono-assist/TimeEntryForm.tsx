
'use client';

import { useState, useTransition, useEffect } from 'react';
import type { TimeEntry } from '@/types/time-entry';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { PreviewEntriesModal } from './PreviewEntriesModal';
import { HistoricalDataModal } from './HistoricalDataModal';
import { getProposedEntriesAction, submitTimeEntriesAction, getHistoricalDataAction } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, ListChecks, History, Send, Eye } from 'lucide-react';

export function TimeEntryForm() {
  const [notes, setNotes] = useState('');
  const [proposedEntries, setProposedEntries] = useState<TimeEntry[]>([]);
  const [localHistoricalData, setLocalHistoricalData] = useState<TimeEntry[]>([]);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);
  
  const [isPendingPreview, startTransitionPreview] = useTransition();
  const [isPendingSubmit, startTransitionSubmit] = useTransition();
  const [isPendingHistorical, startTransitionHistorical] = useTransition();

  const { toast } = useToast();

  const isLoading = isPendingPreview || isPendingSubmit || isPendingHistorical;

  useEffect(() => {
    // Optionally, load historical data on component mount
    handleGetHistoricalData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
        // Pass current localHistoricalData if needed by AI, or AI uses its own version
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
        if (result.success) {
          // Optionally clear notes or reset form
          // setNotes('');
          // setProposedEntries([]);
          // Refresh historical data as new entries might have been added
          handleGetHistoricalData(); 
        }
      } catch (error) {
         toast({
          title: "Submission Failed",
          description: (error as Error).message || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    });
  };

  const handleGetHistoricalData = () => {
    startTransitionHistorical(async () => {
      try {
        const result = await getHistoricalDataAction();
        if (result.success) {
          setLocalHistoricalData(result.data);
          toast({
            title: "Historical Data Updated",
            description: "Local historical data has been refreshed.",
          });
        } else {
          toast({
            title: "Error",
            description: result.message,
            variant: "destructive",
          });
        }
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
  
  const progressValue = isLoading ? undefined : 0;

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
      <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button 
            onClick={handleGetHistoricalData} 
            disabled={isLoading} 
            variant="outline" 
            className="w-full sm:w-auto"
            aria-label="Refresh historical data"
          >
            <History className="mr-2 h-5 w-5" /> Refresh Data
          </Button>
          <Button 
            onClick={() => setIsHistoricalModalOpen(true)} 
            disabled={isLoading || localHistoricalData.length === 0} 
            variant="outline" 
            className="w-full sm:w-auto"
            aria-label="View historical data"
          >
            <Eye className="mr-2 h-5 w-5" /> View Data
          </Button>
        </div>
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
        historicalData={localHistoricalData}
      />
      <HistoricalDataModal
        isOpen={isHistoricalModalOpen}
        onClose={() => setIsHistoricalModalOpen(false)}
        historicalData={localHistoricalData}
      />
    </Card>
  );
}
