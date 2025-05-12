
'use server';
import type { InitialTimeEntryInput, InitialTimeEntryOutput } from '@/ai/flows/initial-time-entry-prompt';
import { initialTimeEntry } from '@/ai/flows/initial-time-entry-prompt';
import { revalidatePath } from 'next/cache';
import type { TimeEntry } from '@/types/time-entry';
import { mockHistoricalDataForAI } from '@/lib/constants';
import { subMonths, parseISO, isValid, format } from 'date-fns';
// To use child_process, you might need to install types: npm install --save-dev @types/node
import { spawnSync } from 'child_process';
import path from 'path';

// Helper to generate unique IDs for client-side rendering
let proposedEntryIdCounter = 0;
const generateProposedEntryId = () => `entry_${Date.now()}_${proposedEntryIdCounter++}`;

let historicalEntryIdCounter = 0;
const generateHistoricalEntryId = () => `hist_${Date.now()}_${historicalEntryIdCounter++}`;

export async function getProposedEntriesAction(notes: string, historicalEntries: TimeEntry[], shorthandNotes?: string): Promise<TimeEntry[]> {
  if (!notes.trim()) {
    return [];
  }

  try {
    // If historicalEntries is empty or undefined, map will result in an empty array.
    // The AI model is expected to handle an empty historicalData array.
    const historicalDataForAI = (historicalEntries && historicalEntries.length > 0)
      ? historicalEntries.map(entry => ({ 
        Date: entry.Date,
        Project: entry.Project,
        Activity: entry.Activity,
        WorkItem: entry.WorkItem,
        Hours: entry.Hours,
        Comment: entry.Comment,
      }))
      : [];


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
    
    return proposedEntries;

  } catch (error) {
    console.error("Error getting proposed entries from AI:", error);
    throw new Error("Failed to generate time entry suggestions. Please try again.");
  }
}

export async function submitTimeEntriesAction(entries: TimeEntry[]): Promise<{ success: boolean; message: string }> {
  if (!entries || entries.length === 0) {
    return { success: false, message: "No entries to submit." };
  }

  console.log("Attempting to submit time entries using Python/Helium script...");
  const pythonScriptPath = path.join(process.cwd(), 'src', 'scripts', 'submit_timesheets.py');
  
  // Serialize entries to pass to the Python script
  // We only need the core data, not the client-side 'id'
  const entriesForScript = entries.map(({ id, ...rest }) => rest);
  const entriesJsonString = JSON.stringify(entriesForScript);

  try {
    const pythonProcess = spawnSync('python', [pythonScriptPath, entriesJsonString], { encoding: 'utf8', timeout: 300000 }); // 5 min timeout

    if (pythonProcess.error) {
      console.error('Failed to start Python submission script:', pythonProcess.error);
      return { success: false, message: `Failed to start submission script: ${pythonProcess.error.message}` };
    }

    const stderrOutput = pythonProcess.stderr?.toString().trim();
    if (stderrOutput) {
        console.log('Python submission script STDERR:', stderrOutput); // Log stderr for debugging
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
    
    console.log("Python submission script executed successfully:", scriptResult.message);
    // Optionally, revalidate historical data if submission implies changes
    revalidatePath('/'); 
    return { success: true, message: scriptResult.message || "Time entries submitted successfully via Python/Helium." };

  } catch (error) {
    console.error("Error submitting time entries via Python script:", error);
    return { success: false, message: `Server error during time submission: ${(error as Error).message}` };
  }
}


export async function getHistoricalDataAction(): Promise<{ success: boolean; message: string, data: TimeEntry[] }> {
  console.log("Attempting to fetch historical data using Python/Helium script...");
  const pythonScriptPath = path.join(process.cwd(), 'src', 'scripts', 'scrape_timesheets.py');
  let rawData;
  let processedData: TimeEntry[] = [];

  try {
    const pythonProcess = spawnSync('python', [pythonScriptPath], { encoding : 'utf8' });

    if (pythonProcess.error) {
      console.error('Failed to start Python script:', pythonProcess.error);
      return handleScriptErrorFallback("Python script failed to start.");
    }

    const stderrOutput = pythonProcess.stderr?.toString().trim();
    if (stderrOutput) { // Log stderr even if script succeeds, for diagnostics
      console.log('Python script stderr:', stderrOutput);
    }


    if (pythonProcess.status !== 0) {
      const errorMsg = stderrOutput || "Unknown Python script execution error.";
      console.error(`Python script exited with error code ${pythonProcess.status}:`);
      console.error('Stderr:', errorMsg);
      return handleScriptErrorFallback(`Python script execution error: ${errorMsg}`);
    }

    rawData = pythonProcess.stdout?.toString().trim();
    if (!rawData) {
        console.warn('Python script executed successfully but produced no output (stdout is empty).');
        // Treat as success but with no data, or could be a fallback depending on requirements
        return { success: true, message: "Historical data script ran successfully but returned no data.", data: [] };
    }

    try {
        const scrapedEntries: Omit<TimeEntry, 'id'>[] = JSON.parse(rawData);
        processedData = scrapedEntries.map(entry => ({
            ...entry,
            id: generateHistoricalEntryId(),
            Date: entry.Date ? format(parseISO(entry.Date), 'yyyy-MM-dd') : new Date().toISOString().split('T')[0] 
        }));
    } catch (jsonError) {
        console.error("Error parsing JSON from Python script output:", jsonError);
        console.error("Raw output from Python script:", rawData);
        return handleScriptErrorFallback("Failed to parse data from Python script.");
    }
    
    if (processedData.length === 0) {
        console.log("Python script ran successfully but returned no time entries.");
        return { success: true, message: "Successfully fetched data, but no time entries were found.", data: [] };
    }

    const currentDate = new Date();
    const threeMonthsAgo = subMonths(currentDate, 3);
    const threeMonthFilteredData = processedData.filter(entry => {
        try {
            const entryDate = parseISO(entry.Date);
            return isValid(entryDate) && entryDate >= threeMonthsAgo && entryDate <= currentDate;
        } catch (e) {
            console.warn(`Could not parse date for entry: ${entry.Date}. Excluding from 3-month filter.`, e);
            return false;
        }
    });

    if (threeMonthFilteredData.length === 0 && processedData.length > 0) {
        console.log(`Successfully fetched ${processedData.length} total entries, but none are within the last 3 months.`);
        return { success: true, message: `Fetched ${processedData.length} total entries, but no entries found from the last 3 months.`, data: threeMonthFilteredData };
    }
    
    console.log(`Successfully fetched ${threeMonthFilteredData.length} entries from the last 3 months via Python script.`);
    return { success: true, message: "Historical data fetched successfully.", data: threeMonthFilteredData };

  } catch (error) {
    console.error("Unhandled error during Python script execution or processing:", error);
    return handleScriptErrorFallback(`An unexpected error occurred: ${(error as Error).message}.`);
  }
}

function handleScriptErrorFallback(errorMessage: string): { success: false; message: string, data: TimeEntry[] } {
    console.warn(`Fallback triggered: ${errorMessage}`);
    // Do not use mock data. Return empty data and indicate failure.
    return { success: false, message: `${errorMessage} Could not load historical data.`, data: [] };
}
    
