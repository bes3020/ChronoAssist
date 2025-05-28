
'use server';
import type { InitialTimeEntryInput, InitialTimeEntryOutput } from '@/ai/flows/initial-time-entry-prompt';
import { initialTimeEntry } from '@/ai/flows/initial-time-entry-prompt';
import { revalidatePath } from 'next/cache';
import type { TimeEntry } from '@/types/time-entry';
import type { UserSettings, UserSettingsWithDefaults } from '@/types/settings'; 
import { defaultUserSettings } from '@/types/settings'; 
import { parseISO, format } from 'date-fns';
import { spawnSync } from 'child_process';
import path from 'path';
import { getAnonymousUserId } from '@/lib/auth';
import * as db from '@/lib/db'; 
import { v4 as uuidv4 } from 'uuid';

db.initializeDb();

const generateProposedEntryId = () => `proposed_${Date.now()}_${uuidv4().substring(0, 8)}`;


export async function getProposedEntriesAction(notes: string, shorthandNotes?: string): Promise<{ rawAiOutputCount: number; filteredEntries: TimeEntry[] }> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); 

  if (!notes.trim()) {
    return { rawAiOutputCount: 0, filteredEntries: [] };
  }

  try {
    const historicalEntriesFromDb = db.getHistoricalEntries(userId); 
    const userSettings = db.getUserSettings(userId); 

    const historicalDataForAI = historicalEntriesFromDb.map(entry => ({ 
      Date: entry.Date,
      Project: entry.Project,
      Activity: entry.Activity,
      WorkItem: entry.WorkItem,
      Comment: entry.Comment,
    }));

    const aiInput: InitialTimeEntryInput = {
      notes,
      historicalData: historicalDataForAI, 
      shorthandNotes: shorthandNotes?.trim() ? shorthandNotes : undefined,
      promptOverride: userSettings.promptOverrideText || undefined, 
    };
    const aiOutput: InitialTimeEntryOutput = await initialTimeEntry(aiInput);
    console.log("Raw AI Output (from getProposedEntriesAction):", JSON.stringify(aiOutput, null, 2));

    const processedEntries: TimeEntry[] = aiOutput.map(entry => ({
      ...entry,
      id: generateProposedEntryId(), 
      Hours: Number(entry.Hours) || 0, 
      submissionError: undefined, // Ensure new AI entries don't have old errors
    }));
    
    console.log("Processed AI Entries by getProposedEntriesAction (no DB save here):", JSON.stringify(processedEntries, null, 2));
    
    return { rawAiOutputCount: aiOutput.length, filteredEntries: processedEntries };

  } catch (error) {
    console.error("Error getting proposed entries from AI (in getProposedEntriesAction):", error);
    return { rawAiOutputCount: 0, filteredEntries: [] };
  }
}

interface PythonSubmissionResponse {
  overallSuccess: boolean;
  message: string;
  submittedEntryClientIds: string[];
  failedEntries: Array<{ client_id: string; error: string }>;
}

export async function submitTimeEntriesAction(entriesToSubmit: TimeEntry[]): Promise<{ success: boolean; message: string; hasErrors: boolean; updatedProposals?: TimeEntry[] }> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId);

  if (!entriesToSubmit || entriesToSubmit.length === 0) {
    return { success: false, message: "No entries to submit.", hasErrors: false };
  }

  console.log("Attempting to submit time entries using Python/Helium script...");
  const pythonScriptPath = path.join(process.cwd(), 'src', 'scripts', 'submit_timesheets.py');
  
  // Pass the full TimeEntry objects, as the script expects 'id' to be the client_id
  const entriesJsonString = JSON.stringify(entriesToSubmit);

  try {
    const pythonProcess = spawnSync('python', [pythonScriptPath, entriesJsonString], { encoding: 'utf8', timeout: 300000 });

    if (pythonProcess.error) {
      console.error('Failed to start Python submission script:', pythonProcess.error);
      return { success: false, message: `Failed to start submission script: ${pythonProcess.error.message}`, hasErrors: true };
    }

    const stderrOutput = pythonProcess.stderr?.toString().trim();
    if (stderrOutput) {
        console.log('Python submission script STDERR:', stderrOutput);
    }
    
    const stdoutOutput = pythonProcess.stdout?.toString().trim();
    if (!stdoutOutput) {
        console.error('Python submission script produced no STDOUT output.');
        return { success: false, message: 'Submission script produced no output. Check server logs for Python script STDERR.', hasErrors: true };
    }
    
    let scriptResult: PythonSubmissionResponse;
    try {
        scriptResult = JSON.parse(stdoutOutput);
    } catch (e) {
        console.error('Failed to parse JSON response from Python submission script:', e);
        console.error('Python script STDOUT:', stdoutOutput);
        return { success: false, message: 'Invalid response from submission script. Check server logs.', hasErrors: true};
    }

    // Process results
    const currentProposedEntries = await db.getProposedEntries(userId);
    let remainingProposedEntries: TimeEntry[] = [];
    const successfullySubmittedEntriesForHistory: TimeEntry[] = [];

    // Populate error messages for failed entries
    const failedClientIds = new Set(scriptResult.failedEntries.map(f => f.client_id));
    
    for (const proposed of currentProposedEntries) {
        const failureDetail = scriptResult.failedEntries.find(f => f.client_id === proposed.id);
        if (failureDetail) {
            remainingProposedEntries.push({ ...proposed, submissionError: failureDetail.error });
        } else if (scriptResult.submittedEntryClientIds.includes(proposed.id)) {
            // This entry was successfully submitted
            successfullySubmittedEntriesForHistory.push({ ...proposed, submissionError: undefined });
        } else {
            // This entry was not part of the submission batch (e.g., user added more after AI)
            // or something went wrong with tracking. Keep it as is for now.
             remainingProposedEntries.push({ ...proposed, submissionError: undefined });
        }
    }
    
    // If an entry was in entriesToSubmit but not found in currentProposed (shouldn't happen if UI is in sync)
    // and it failed, we might need to add it back to remainingProposed with an error.
    // For simplicity, we assume entriesToSubmit is a subset of currentProposedEntries.

    if (successfullySubmittedEntriesForHistory.length > 0) {
      db.addHistoricalEntries(userId, successfullySubmittedEntriesForHistory);
    }

    db.saveProposedEntries(userId, remainingProposedEntries); // Save remaining/failed entries

    revalidatePath('/'); 
    return { 
        success: scriptResult.overallSuccess, 
        message: scriptResult.message || "Time submission script process completed.",
        hasErrors: scriptResult.failedEntries.length > 0,
        updatedProposals: remainingProposedEntries 
    };

  } catch (error) {
    console.error("Error submitting time entries via Python script:", error);
    return { success: false, message: `Server error during time submission: ${(error as Error).message}`, hasErrors: true };
  }
}


export async function getHistoricalDataAction(): Promise<{ success: boolean; message: string; data: TimeEntry[] }> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId);
  try {
    console.log(`Fetching historical data from DB for user ${userId}...`);
    const data = db.getHistoricalEntries(userId); 
    return { success: true, message: "Historical data fetched from local storage.", data };
  } catch (error) {
    console.error("Error fetching historical data from DB:", error);
    return { success: false, message: `Error fetching data from local storage: ${(error as Error).message}`, data: [] };
  }
}

export async function refreshHistoricalDataFromScriptAction(): Promise<{ success: boolean; message: string, data: TimeEntry[] }> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); 
  const userSettings = await db.getUserSettings(userId); 

  console.log(`Attempting to refresh historical data from script for user ${userId} with ${userSettings.historicalDataDays} days setting...`);
  const pythonScriptPath = path.join(process.cwd(), 'src', 'scripts', 'scrape_timesheets.py');
  
  try {
    const pythonProcess = spawnSync('python', [pythonScriptPath, userSettings.historicalDataDays.toString()], { encoding : 'utf8', timeout: 300000 });

    if (pythonProcess.error) {
      console.error('Failed to start Python script:', pythonProcess.error);
      const existingData = db.getHistoricalEntries(userId);
      return { success: false, message: `Python script failed to start. ${existingData.length > 0 ? 'Showing previously loaded data.' : 'No historical data available.'}`, data: existingData };
    }

    const stderrOutput = pythonProcess.stderr?.toString().trim();
    if (stderrOutput) { 
      console.log('Python script stderr:', stderrOutput);
    }

    if (pythonProcess.status !== 0) {
      const errorMsg = stderrOutput || "Unknown Python script execution error.";
      console.error(`Python script exited with error code ${pythonProcess.status}:`);
      console.error('Stderr:', errorMsg);
      const existingData = db.getHistoricalEntries(userId);
      return { success: false, message: `Python script execution error. ${existingData.length > 0 ? 'Showing previously loaded data.' : 'No historical data available.'}`, data: existingData };
    }

    const rawData = pythonProcess.stdout?.toString().trim();
    if (!rawData) {
        console.warn('Python script executed successfully but produced no output (stdout is empty).');
        const existingData = db.getHistoricalEntries(userId);
        return { success: true, message: `Historical data script ran but returned no new data. ${existingData.length > 0 ? 'Showing previously loaded data.' : 'No historical data available.'}`, data: existingData };
    }

    type ScrapedEntryMaybeNoHours = Omit<TimeEntry, 'id' | 'Hours'> & { Hours?: number | string }; 
    let scrapedEntries: ScrapedEntryMaybeNoHours[];
    try {
        scrapedEntries = JSON.parse(rawData);
    } catch (jsonError) {
        console.error("Error parsing JSON from Python script output:", jsonError);
        console.error("Raw output from Python script:", rawData);
        const existingData = db.getHistoricalEntries(userId);
        return { success: false, message: `Failed to parse data from Python script. ${existingData.length > 0 ? 'Showing previously loaded data.' : 'No historical data available.'}`, data: existingData };
    }
    
    const processedScrapedData: TimeEntry[] = scrapedEntries.map((entry, index) => ({
        ...entry,
        id: `scraped_${Date.now()}_${index}`, 
        Date: entry.Date ? format(parseISO(entry.Date), 'yyyy-MM-dd') : new Date().toISOString().split('T')[0],
        Hours: 0, 
        Comment: entry.Comment || '',
        Project: entry.Project || '',
        Activity: entry.Activity || '',
        WorkItem: entry.WorkItem || '',
    }));

    db.addHistoricalEntries(userId, processedScrapedData); 
    
    const allHistoricalData = db.getHistoricalEntries(userId, null); 

    if (allHistoricalData.length === 0) {
        return { success: true, message: "Successfully fetched data, but no time entries were found.", data: [] };
    }
    
    console.log(`Successfully processed ${processedScrapedData.length} new entries. Total relevant historical entries for user ${userId}: ${allHistoricalData.length}.`);
    revalidatePath('/');
    return { success: true, message: "Historical data fetched and updated successfully.", data: allHistoricalData };

  } catch (error) {
    console.error("Unhandled error during Python script execution or processing:", error);
    const existingData = db.getHistoricalEntries(userId);
    return { success: false, message: `An unexpected error occurred: ${(error as Error).message}. ${existingData.length > 0 ? 'Showing previously loaded data.' : 'No historical data available.'}`, data: existingData };
  }
}

export async function getUserShorthandAction(): Promise<string> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); 
  return db.getShorthand(userId) || '';
}

export async function saveUserShorthandAction(text: string): Promise<{ success: boolean; message: string }> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); 
  try {
    db.saveShorthand(userId, text);
    revalidatePath('/'); 
    return { success: true, message: "Shorthand saved." };
  } catch (error) {
    console.error("Error saving shorthand:", error);
    return { success: false, message: "Failed to save shorthand." };
  }
}

export async function getUserMainNotesAction(): Promise<string> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); 
  return db.getMainNotes(userId) || '';
}

export async function saveUserMainNotesAction(text: string): Promise<{ success: boolean; message: string }> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); 
  try {
    db.saveMainNotes(userId, text);
    return { success: true, message: "Notes saved." };
  } catch (error) {
    console.error("Error saving main notes:", error);
    return { success: false, message: "Failed to save notes." };
  }
}

export async function getUserProposedEntriesAction(): Promise<TimeEntry[]> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); 
  return db.getProposedEntries(userId);
}

export async function saveUserProposedEntriesAction(entries: TimeEntry[]): Promise<{ success: boolean; message: string }> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); 
  try {
    const entriesWithClearedErrors = entries.map(e => ({...e, submissionError: undefined}));
    db.saveProposedEntries(userId, entriesWithClearedErrors);
    revalidatePath('/');
    if (entries.length === 0) {
        return { success: true, message: "Proposed entries cleared." };
    }
    return { success: true, message: "Proposed entries updated." };
  } catch (error) {
    console.error("Error saving proposed entries:", error);
    return { success: false, message: "Failed to update proposed entries." };
  }
}

// User Settings Actions
export async function getUserSettingsAction(): Promise<UserSettingsWithDefaults> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); 
  return db.getUserSettings(userId);
}

export async function saveUserSettingsAction(settings: Partial<UserSettings>): Promise<{ success: boolean; message: string }> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); 
  try {
    db.saveUserSettings(userId, settings);
    revalidatePath('/');
    return { success: true, message: "Settings saved." };
  } catch (error) {
    console.error("Error saving user settings:", error);
    return { success: false, message: "Failed to save settings." };
  }
}
