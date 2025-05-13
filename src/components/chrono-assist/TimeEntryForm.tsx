
'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import type { TimeEntry } from '@/types/time-entry';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { PreviewEntriesModal } from './PreviewEntriesModal';
import { HistoricalDataModal } from './HistoricalDataModal';
import { ShorthandModal } from './ShorthandModal';
import { GenerateOrAddModal } from './GenerateOrAddModal'; // New Modal
import { 
  getProposedEntriesAction, 
  submitTimeEntriesAction, 
  getHistoricalDataAction,
  refreshHistoricalDataFromScriptAction,
  getUserShorthandAction,
  saveUserShorthandAction,
  getUserMainNotesAction,
  saveUserMainNotesAction,
  getUserProposedEntriesAction,
  saveUserProposedEntriesAction
} from '@/lib/actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, ListChecks, History, Send, ChevronDown, Eye, RefreshCw, NotebookPen, Edit3, Brain } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDebouncedCallback } from 'use-debounce';
import { v4 as uuidv4 } from 'uuid';


// Helper to generate unique IDs, moved here to be accessible by merge logic
const generateProposedEntryId = () => `proposed_${Date.now()}_${uuidv4().substring(0, 8)}`;


export function TimeEntryForm() {
  const [notes, setNotes] = useState('');
  const [shorthandNotes, setShorthandNotes] = useState('');
  const [proposedEntries, setProposedEntries] = useState<TimeEntry[]>([]);
  const [localHistoricalData, setLocalHistoricalData] = useState<TimeEntry[]>([]);
  
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);
  const [isShorthandModalOpen, setIsShorthandModalOpen] = useState(false);
  const [isGenerateOrAddModalOpen, setIsGenerateOrAddModalOpen] = useState(false); // New state

  const [isProcessing, startTransitionProcessing] = useTransition(); // General processing state
  const [isPendingHistoricalRefresh, startTransitionHistoricalRefresh] = useTransition();
  const [isPendingInitialLoad, startTransitionInitialLoad] = useTransition();

  const { toast } = useToast();

  const isLoading = isProcessing || isPendingHistoricalRefresh || isPendingInitialLoad;

  const debouncedSaveNotes = useDebouncedCallback(async (newNotes: string) => {
    await saveUserMainNotesAction(newNotes);
  }, 1000); 

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newNotes = e.target.value;
    setNotes(newNotes);
    debouncedSaveNotes(newNotes);
  };
  
  useEffect(() => {
    startTransitionInitialLoad(async () => {
      try {
        const [loadedNotes, loadedShorthand, dbHistoricalResult, loadedProposed] = await Promise.all([
          getUserMainNotesAction(),
          getUserShorthandAction(),
          getHistoricalDataAction(),
          getUserProposedEntriesAction()
        ]);
        setNotes(loadedNotes);
        setShorthandNotes(loadedShorthand);
        
        if (dbHistoricalResult.success) {
          setLocalHistoricalData(dbHistoricalResult.data);
          if (dbHistoricalResult.data.length === 0) {
             toast({
              title: "Historical Data",
              description: "No historical data found in local storage. You can try fetching fresh data using 'Refresh Data'.",
              variant: "default"
            });
          }
        } else {
          toast({
            title: "Failed to Load Historical Data",
            description: dbHistoricalResult.message,
            variant: "destructive",
          });
        }
        setProposedEntries(loadedProposed);

      } catch (error) {
        toast({
          title: "Error Loading Initial Data",
          description: (error as Error).message || "Could not load your saved data.",
          variant: "destructive",
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleTimesheetAI = () => {
    if (!notes.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter some notes before using Timesheet AI.",
        variant: "destructive",
      });
      return;
    }
    if (localHistoricalData.length === 0) {
      toast({
        title: "Historical Data Missing",
        description: "Historical data is empty. Please load historical data first (use 'Refresh Data' under 'Historical Data' menu).",
        variant: "destructive",
      });
      return;
    }
    setIsGenerateOrAddModalOpen(true);
  };

  const processAiEntries = async (mode: 'generate' | 'add') => {
    setIsGenerateOrAddModalOpen(false);
    startTransitionProcessing(async () => {
      try {
        const aiResult = await getProposedEntriesAction(notes, shorthandNotes);
        let finalEntries: TimeEntry[] = [];

        if (mode === 'generate') {
          finalEntries = aiResult.filteredEntries;
        } else { // mode === 'add'
          const existingEntries = await getUserProposedEntriesAction();
          // Ensure new entries from AI get unique IDs if merged
          const newAiEntriesWithUniqueIds = aiResult.filteredEntries.map(entry => ({
            ...entry,
            id: generateProposedEntryId() 
          }));
          finalEntries = [...existingEntries, ...newAiEntriesWithUniqueIds];
        }

        await saveUserProposedEntriesAction(finalEntries);
        setProposedEntries(finalEntries);
        
        if (aiResult.rawAiOutputCount > 0 && finalEntries.length === 0 && notes.trim() !== "") {
             toast({
              title: "Suggestions Incomplete or Filtered",
              description: "AI made suggestions, but they might have been incomplete or filtered out. Review notes or historical data.",
              variant: "default" 
            });
        } else if (aiResult.rawAiOutputCount === 0 && notes.trim() !== "") {
           toast({
            title: "No Suggestions Found",
            description: "AI could not generate any time entry suggestions. Try adding more details or check your historical data.",
             variant: "default"
          });
        }
        
        if (finalEntries.length > 0 || (aiResult.rawAiOutputCount > 0 && notes.trim() !== "")) {
            setIsPreviewModalOpen(true);
        }

      } catch (error) {
        toast({
          title: "Error Processing AI Entries",
          description: (error as Error).message || "Failed to process entries with AI.",
          variant: "destructive",
        });
      }
    });
  };
  
  const handleEditTime = () => {
    startTransitionProcessing(async () => {
        try {
            const currentEntries = await getUserProposedEntriesAction();
            if (currentEntries.length === 0) {
                toast({
                    title: "No Entries to Edit",
                    description: "There are no time entries to edit. Use Timesheet AI to generate some first.",
                    variant: "default",
                });
                setProposedEntries([]); // Ensure local state is also empty
                return;
            }
            setProposedEntries(currentEntries);
            setIsPreviewModalOpen(true);
        } catch (error) {
            toast({
                title: "Error Loading Entries for Editing",
                description: (error as Error).message || "Could not load entries.",
                variant: "destructive",
            });
        }
    });
  };


  const handleSubmitTime = () => {
    if (proposedEntries.length === 0 && notes.trim() === "") {
       // Check if proposedEntries in state is empty. If so, try to load from DB.
       startTransitionProcessing(async () => {
        const latestProposedEntriesFromDb = await getUserProposedEntriesAction();
        if (latestProposedEntriesFromDb.length === 0) {
            toast({
                title: "No Entries",
                description: "There are no entries to submit. Use Timesheet AI or Edit Time first.",
                variant: "destructive",
            });
            return;
        }
        setProposedEntries(latestProposedEntriesFromDb); // Update state
        // Now proceed to submit these entries
        performSubmit(latestProposedEntriesFromDb);
       });
    } else if (proposedEntries.length === 0 && notes.trim() !== "") {
        toast({
            title: "No Entries Generated",
            description: "Please use Timesheet AI or Edit Time to create/review entries before submitting.",
            variant: "destructive",
        });
    }
     else {
      // Entries exist in state, proceed with them
      performSubmit(proposedEntries);
    }
  };

  const performSubmit = (entriesToSubmit: TimeEntry[]) => {
    startTransitionProcessing(async () => {
      try {
        const result = await submitTimeEntriesAction(entriesToSubmit);
        toast({
          title: result.success ? "Success" : "Error",
          description: result.message,
          variant: result.success ? "default" : "destructive",
        });
        if (result.success) {
          setProposedEntries([]); 
          await saveUserProposedEntriesAction([]); // Clear from DB as well
          handleRefreshHistoricalDataFromScript(); 
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

  const handleRefreshHistoricalDataFromScript = useCallback(() => {
    startTransitionHistoricalRefresh(async () => {
      try {
        const scriptResult = await refreshHistoricalDataFromScriptAction();
        if (scriptResult.success) {
          setLocalHistoricalData(scriptResult.data);
          if (scriptResult.data.length > 0) {
            toast({
              title: "Historical Data Updated",
              description: scriptResult.message || `Successfully fetched/updated ${scriptResult.data.length} historical entries.`,
            });
          } else {
             toast({
              title: "Historical Data Empty",
              description: scriptResult.message || "No historical time entries were found after refresh.",
              variant: "default"
            });
          }
        } else {
          setLocalHistoricalData(scriptResult.data || []); 
          toast({
            title: "Failed to Refresh Data",
            description: scriptResult.message || "Could not retrieve fresh historical data.",
            variant: "destructive",
          });
        }
      } catch (error) {
        setLocalHistoricalData([]); 
        toast({
          title: "Error Fetching Data",
          description: (error as Error).message || "An unexpected error occurred while fetching historical data.",
          variant: "destructive",
        });
      }
    });
  }, [startTransitionHistoricalRefresh, toast]);

  const handleSaveModalEntries = (updatedEntries: TimeEntry[]) => {
    startTransitionProcessing(async () => { 
        try {
            await saveUserProposedEntriesAction(updatedEntries);
            setProposedEntries(updatedEntries);
            toast({
                title: "Entries Updated",
                description: "Your changes to the time entries have been saved.",
            });
        } catch (error) {
            toast({
                title: "Error Saving Entries",
                description: (error as Error).message || "Failed to save proposed entries.",
                variant: "destructive",
            });
        }
    });
  };

  const handleSaveShorthand = (newShorthand: string) => {
    startTransitionProcessing(async () => { 
        try {
            await saveUserShorthandAction(newShorthand);
            setShorthandNotes(newShorthand);
            toast({
                title: "Shorthand Updated",
                description: "Your shorthand notes have been saved.",
            });
        } catch (error) {
            toast({
                title: "Error Saving Shorthand",
                description: (error as Error).message || "Failed to save shorthand.",
                variant: "destructive",
            });
        }
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
          Enter your work notes below. The AI will help suggest time entries based on historical data. Use the 'My Shorthand' button to define common abbreviations. Your notes are saved automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Textarea
            placeholder="Describe your work, e.g., 'Worked on Project Alpha login feature, attended Beta sprint planning meeting...'"
            value={notes}
            onChange={handleNotesChange}
            rows={15}
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
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setIsShorthandModalOpen(true)}
            disabled={isLoading}
            aria-label="Edit my shorthand notes"
          >
            <NotebookPen className="mr-2 h-5 w-5" /> My Shorthand
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full sm:w-auto" 
                disabled={isLoading}
                aria-label="Historical data options"
              >
                <History className="mr-2 h-5 w-5" /> Historical Data <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem 
                onClick={handleRefreshHistoricalDataFromScript} 
                disabled={isPendingHistoricalRefresh || isPendingInitialLoad}
                aria-label="Refresh historical data from script"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh Data
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setIsHistoricalModalOpen(true)} 
                disabled={isLoading || localHistoricalData.length === 0}
                aria-label="View historical data"
              >
                <Eye className="mr-2 h-4 w-4" /> View Data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Button 
            onClick={handleTimesheetAI} 
            disabled={isLoading || !notes.trim()} 
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
            aria-label="Use Timesheet AI to generate or add entries"
          >
            <Brain className="mr-2 h-5 w-5" /> Timesheet AI
          </Button>
           <Button 
            onClick={handleEditTime} 
            disabled={isLoading} 
            variant="outline"
            className="w-full sm:w-auto"
            aria-label="Edit existing time entries"
          >
            <Edit3 className="mr-2 h-5 w-5" /> Edit Time
          </Button>
          <Button 
            onClick={handleSubmitTime} 
            disabled={isLoading || (proposedEntries.length === 0 && !notes.trim())}
            className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90"
            aria-label="Submit current time entries"
          >
            <Send className="mr-2 h-5 w-5" /> Submit Time
          </Button>
        </div>
      </CardFooter>

      <GenerateOrAddModal
        isOpen={isGenerateOrAddModalOpen}
        onClose={() => setIsGenerateOrAddModalOpen(false)}
        onGenerateNew={() => processAiEntries('generate')}
        onAddToExisting={() => processAiEntries('add')}
      />
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
      <ShorthandModal
        isOpen={isShorthandModalOpen}
        onClose={() => setIsShorthandModalOpen(false)}
        currentShorthand={shorthandNotes}
        onSave={handleSaveShorthand}
      />
    </Card>
  );
}

