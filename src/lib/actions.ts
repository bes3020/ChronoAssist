
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

export async function getProposedEntriesAction(notes: string, shorthandNotes?: string): Promise<TimeEntry[]> {
  if (!notes.trim()) {
    return [];
  }

  try {
    // Fetch historical data for the AI to use.
    const historicalDataResult = await getHistoricalDataAction();
    let historicalDataForAI;

    if (historicalDataResult.success && historicalDataResult.data.length > 0) {
        historicalDataForAI = historicalDataResult.data.map(entry => ({ 
        Date: entry.Date,
        Project: entry.Project,
        Activity: entry.Activity,
        WorkItem: entry.WorkItem,
        Hours: entry.Hours,
        Comment: entry.Comment,
      }));
    } else {
      // Fallback to mock data if fetch fails or returns no data
      console.warn("Falling back to mock historical data for AI suggestions due to issues with live data retrieval.");
      historicalDataForAI = mockHistoricalDataForAI;
    }


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
      // Fallback to mock data if script fails to start
      return handleScriptErrorFallback("Python script failed to start. Using mock data.");
    }

    const stderrOutput = pythonProcess.stderr?.toString().trim();
    console.log('Python script stderr:', stderrOutput || "No stderr output.");

    if (pythonProcess.status !== 0) {
      const stderrOutput = pythonProcess.stderr?.toString().trim();
      console.error(`Python script exited with error code ${pythonProcess.status}:`);
      console.error('Stderr:', stderrOutput || "No stderr output.");
      // Fallback to mock data if script exits with an error
      return handleScriptErrorFallback(`Python script execution error. ${stderrOutput || "Details in server logs."} Using mock data.`);
    }

    rawData = pythonProcess.stdout?.toString().trim();
    if (!rawData) {
        console.warn('Python script executed successfully but produced no output (stdout is empty).');
        return handleScriptErrorFallback("Python script produced no data. Using mock data.");
    }

    try {
        const scrapedEntries: Omit<TimeEntry, 'id'>[] = JSON.parse(rawData);
        processedData = scrapedEntries.map(entry => ({
            ...entry,
            id: generateHistoricalEntryId(),
            //Hours: Number(entry.Hours) || 0,
            Date: entry.Date ? format(parseISO(entry.Date), 'yyyy-MM-dd') : new Date().toISOString().split('T')[0] // Ensure date format
        }));
    } catch (jsonError) {
        console.error("Error parsing JSON from Python script output:", jsonError);
        console.error("Raw output from Python script:", rawData);
        return handleScriptErrorFallback("Failed to parse data from Python script. Using mock data.");
    }
    
    if (processedData.length === 0) {
        console.log("Python script ran successfully but returned no time entries.");
        // It's possible the user has no entries, so we return empty data with success.
        // Or, if this is unexpected, one might choose to fallback. For now, trust the script.
        return { success: true, message: "Successfully fetched data, but no time entries were found for your account on XYZ.com.", data: [] };
    }

    // Apply 3-month filter
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
    return { success: true, message: "Historical data fetched successfully via Python/Helium.", data: threeMonthFilteredData };

  } catch (error) {
    console.error("Unhandled error during Python script execution or processing:", error);
    return handleScriptErrorFallback(`An unexpected error occurred. ${(error as Error).message}. Using mock data.`);
  }
}

function handleScriptErrorFallback(errorMessage: string): { success: boolean; message: string, data: TimeEntry[] } {
    console.warn(errorMessage);
    // Simulate using mock data as a fallback
    try {
        const currentDate = new Date();
        const threeMonthsAgo = subMonths(currentDate, 3);
        
        const filteredData = mockHistoricalDataForAI.filter(entry => {
          try {
            const entryDate = parseISO(entry.Date); 
            return isValid(entryDate) && entryDate >= threeMonthsAgo && entryDate <= currentDate;
          } catch (e) {
            console.warn(`Could not parse date for mock entry: ${entry.Date}. Excluding from 3-month filter.`, e);
            return false; 
          }
        }).map((entry) => ({
          ...entry,
          id: generateHistoricalEntryId(), 
          Hours: Number(entry.Hours) || 0, 
        }));

        if (filteredData.length === 0 && mockHistoricalDataForAI.length > 0) {
            console.warn("No mock historical data found for the last 3 months. Returning all available mock data as fallback.");
            const allMockDataWithIds = mockHistoricalDataForAI.map(entry => ({
                ...entry,
                id: generateHistoricalEntryId(),
                Hours: Number(entry.Hours) || 0,
            }));
            return { success: true, message: `${errorMessage} No mock entries found for the last 3 months. Displaying all mock data.`, data: allMockDataWithIds };
        }
        
        if (filteredData.length === 0 && mockHistoricalDataForAI.length === 0) {
          return { success: true, message: `${errorMessage} No mock data available.`, data: [] };
        }

        console.log(`Fallback: Using ${filteredData.length} mock entries for the last 3 months.`);
        return { success: true, message: `${errorMessage} Displaying mock data for the last 3 months.`, data: filteredData };

    } catch (processingError) {
        console.error("Error during fallback mock data processing:", processingError);
        return { success: false, message: `${errorMessage} Additionally, an error occurred while processing mock fallback data.`, data: [] };
    }
}
    

