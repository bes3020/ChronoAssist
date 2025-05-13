'use server';
import type { InitialTimeEntryInput, InitialTimeEntryOutput } from '@/ai/flows/initial-time-entry-prompt';
import { initialTimeEntry } from '@/ai/flows/initial-time-entry-prompt';
import { revalidatePath } from 'next/cache';
import type { TimeEntry } from '@/types/time-entry';
import { subMonths, parseISO, isValid, format } from 'date-fns';
import { spawnSync } from 'child_process';
import path from 'path';
import { getAnonymousUserId } from '@/lib/auth';
import * as db from '@/lib/db'; // Import all exports from db.ts

// Initialize DB (safe to call multiple times, only runs once)
db.initializeDb();

// Helper to generate unique IDs for client-side rendering of proposed entries
let proposedEntryIdCounter = 0;
const generateProposedEntryId = () => `proposed_${Date.now()}_${proposedEntryIdCounter++}`;


export async function getProposedEntriesAction(notes: string, shorthandNotes?: string): Promise<TimeEntry[]> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); // Ensure parent records exist

  if (!notes.trim()) {
    await db.clearProposedEntries(userId); // Clear any old proposed entries if notes are empty
    return [];
  }

  try {
    const historicalEntriesFromDb = db.getHistoricalEntries(userId, 3); // Fetch last 3 months for AI context

    const historicalDataForAI = historicalEntriesFromDb.map(entry => ({ 
      Date: entry.Date,
      Project: entry.Project,
      Activity: entry.Activity,
      WorkItem: entry.WorkItem,
      Hours: entry.Hours,
      Comment: entry.Comment,
    }));

    const aiInput: InitialTimeEntryInput = {
      notes,
      historicalData: historicalDataForAI, 
      shorthandNotes: shorthandNotes?.trim() ? shorthandNotes : undefined,
    };
    const aiOutput: InitialTimeEntryOutput = await initialTimeEntry(aiInput);

    const proposedEntries: TimeEntry[] = aiOutput.map(entry => ({
      ...entry,
      id: generateProposedEntryId(), 
      Hours: Number(entry.Hours) || 0, 
    })).filter(entry => entry.Project && entry.Activity && entry.WorkItem); 
    
    db.saveProposedEntries(userId, proposedEntries); // Save to DB
    return proposedEntries;

  } catch (error) {
    console.error("Error getting proposed entries from AI:", error);
    // Don't clear proposed entries here, as there might be valid old ones
    throw new Error("Failed to generate time entry suggestions. Please try again.");
  }
}

export async function submitTimeEntriesAction(entries: TimeEntry[]): Promise<{ success: boolean; message: string }> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); // Ensure parent records exist

  if (!entries || entries.length === 0) {
    return { success: false, message: "No entries to submit." };
  }

  console.log("Attempting to submit time entries using Python/Helium script...");
  const pythonScriptPath = path.join(process.cwd(), 'src', 'scripts', 'submit_timesheets.py');
  
  const entriesForScript = entries.map(({ id, ...rest }) => rest);
  const entriesJsonString = JSON.stringify(entriesForScript);

  try {
    const pythonProcess = spawnSync('python', [pythonScriptPath, entriesJsonString], { encoding: 'utf8', timeout: 300000 });

    if (pythonProcess.error) {
      console.error('Failed to start Python submission script:', pythonProcess.error);
      return { success: false, message: `Failed to start submission script: ${pythonProcess.error.message}` };
    }

    const stderrOutput = pythonProcess.stderr?.toString().trim();
    if (stderrOutput) {
        console.log('Python submission script STDERR:', stderrOutput);
    }
    
    const stdoutOutput = pythonProcess.stdout?.toString().trim();
    if (!stdoutOutput) {
        console.error('Python submission script produced no STDOUT output.');
        return { success: false, message: 'Submission script produced no output. Check server logs for Python script STDERR.' };
    }
    
    let scriptResult;
    try {
        scriptResult = JSON.parse(stdoutOutput);
    } catch (e) {
        console.error('Failed to parse JSON response from Python submission script:', e);
        console.error('Python script STDOUT:', stdoutOutput);
        return { success: false, message: 'Invalid response from submission script. Check server logs.'};
    }

    if (pythonProcess.status !== 0 || !scriptResult.success) {
      console.error(`Python submission script exited with status ${pythonProcess.status} or reported failure.`);
      return { success: false, message: scriptResult.message || "Time submission script failed. Check server logs for Python script details." };
    }
    
    // If script submission is successful, add these entries to historical data in DB
    db.addHistoricalEntries(userId, entries.map(e => ({...e, id: e.id || generateProposedEntryId() /* ensure id for db if somehow missing */}))); // client_id becomes the main id here
    db.clearProposedEntries(userId); // Clear proposed entries after successful submission

    console.log("Python submission script executed successfully:", scriptResult.message);
    revalidatePath('/'); 
    return { success: true, message: scriptResult.message || "Time entries submitted successfully and saved to local history." };

  } catch (error) {
    console.error("Error submitting time entries via Python script:", error);
    return { success: false, message: `Server error during time submission: ${(error as Error).message}` };
  }
}


export async function getHistoricalDataAction(): Promise<{ success: boolean; message: string, data: TimeEntry[] }> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); // Ensure parent records exist

  console.log(`Fetching historical data for user ${userId}...`);

  // Optional: Check if DB has "fresh enough" data to avoid running the script too often
  // For now, we always run the script if historical data is explicitly requested.
  // A more advanced check:
  // const lastFetchTimestamp = db.getLatestHistoricalEntryTimestamp(userId);
  // if (lastFetchTimestamp && (new Date().getTime() - new Date(lastFetchTimestamp).getTime()) < SOME_THRESHOLD_MS) {
  //   const dataFromDb = db.getHistoricalEntries(userId);
  //   return { success: true, message: "Historical data fetched from local cache.", data: dataFromDb };
  // }

  console.log("Attempting to fetch historical data using Python/Helium script...");
  const pythonScriptPath = path.join(process.cwd(), 'src', 'scripts', 'scrape_timesheets.py');
  
  try {
    const pythonProcess = spawnSync('python', [pythonScriptPath], { encoding : 'utf8', timeout: 300000 }); // 5 min timeout

    if (pythonProcess.error) {
      console.error('Failed to start Python script:', pythonProcess.error);
      // Return existing DB data as fallback or empty if none
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

    let scrapedEntries: Omit<TimeEntry, 'id'>[];
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
        id: `scraped_${Date.now()}_${index}`, // Generate a temporary client_id for these new entries
        Date: entry.Date ? format(parseISO(entry.Date), 'yyyy-MM-dd') : new Date().toISOString().split('T')[0] 
    }));

    db.addHistoricalEntries(userId, processedScrapedData); // Add new entries to DB
    
    const allHistoricalData = db.getHistoricalEntries(userId, 3); // Fetch all, including newly added, limited to 3 months for display

    if (allHistoricalData.length === 0) {
        return { success: true, message: "Successfully fetched data, but no time entries were found.", data: [] };
    }
    
    console.log(`Successfully processed ${processedScrapedData.length} new entries. Total relevant historical entries for user ${userId}: ${allHistoricalData.length}.`);
    return { success: true, message: "Historical data fetched and updated successfully.", data: allHistoricalData };

  } catch (error) {
    console.error("Unhandled error during Python script execution or processing:", error);
    const existingData = db.getHistoricalEntries(userId);
    return { success: false, message: `An unexpected error occurred: ${(error as Error).message}. ${existingData.length > 0 ? 'Showing previously loaded data.' : 'No historical data available.'}`, data: existingData };
  }
}

// --- Actions for Shorthand and Main Notes ---

export async function getUserShorthandAction(): Promise<string> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); // Ensure record exists before trying to get
  return db.getShorthand(userId) || '';
}

export async function saveUserShorthandAction(text: string): Promise<{ success: boolean; message: string }> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); // Ensure record exists before trying to save (though saveShorthand would create it)
  try {
    db.saveShorthand(userId, text);
    revalidatePath('/'); // Revalidate to reflect changes if displayed elsewhere
    return { success: true, message: "Shorthand saved." };
  } catch (error) {
    console.error("Error saving shorthand:", error);
    return { success: false, message: "Failed to save shorthand." };
  }
}

export async function getUserMainNotesAction(): Promise<string> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); // Ensure record exists
  return db.getMainNotes(userId) || '';
}

export async function saveUserMainNotesAction(text: string): Promise<{ success: boolean; message: string }> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); // Ensure record exists
  try {
    db.saveMainNotes(userId, text);
    // No revalidatePath needed if main notes are only used in the form's state
    return { success: true, message: "Notes saved." };
  } catch (error) {
    console.error("Error saving main notes:", error);
    return { success: false, message: "Failed to save notes." };
  }
}

// --- Actions for Proposed Entries (if needed beyond getProposedEntriesAction) ---

export async function getUserProposedEntriesAction(): Promise<TimeEntry[]> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); // Ensure record exists
  return db.getProposedEntries(userId);
}

export async function saveUserProposedEntriesAction(entries: TimeEntry[]): Promise<{ success: boolean; message: string }> {
  const userId = await getAnonymousUserId();
  db.ensureUserRecordsExist(userId); // Ensure record exists before saving proposed entries
  try {
    db.saveProposedEntries(userId, entries);
    revalidatePath('/');
    return { success: true, message: "Proposed entries updated." };
  } catch (error) {
    console.error("Error saving proposed entries:", error);
    return { success: false, message: "Failed to update proposed entries." };
  }
}

