
'use server';
import type { InitialTimeEntryInput, InitialTimeEntryOutput } from '@/ai/flows/initial-time-entry-prompt';
import { initialTimeEntry } from '@/ai/flows/initial-time-entry-prompt';
import { revalidatePath } from 'next/cache';
import type { TimeEntry } from '@/types/time-entry';
import { mockHistoricalDataForAI } from '@/lib/constants';
import { subMonths, parseISO } from 'date-fns';
// To use child_process, you might need to install types: npm install --save-dev @types/node
// import { spawnSync } from 'child_process';
// import path from 'path';

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
    const historicalDataForAI = historicalDataResult.success ? 
      historicalDataResult.data.map(entry => ({ // Convert to AI-expected format if different
        Date: entry.Date,
        Project: entry.Project,
        Activity: entry.Activity,
        WorkItem: entry.WorkItem,
        Hours: entry.Hours,
        Comment: entry.Comment,
      })) 
      : mockHistoricalDataForAI; // Fallback to raw mock if fetch fails

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
  try {
    // This function assumes localStorage is available if 'use client' context could call it,
    // but server actions run on the server. For true persistence from a server action,
    // you'd write to a database or a server-side file.
    // The previous implementation attempted to use localStorage which is client-side.
    // For this example, we'll just log and simulate success.
    // If you need to update data that getHistoricalDataAction might fetch,
    // this would be the place to trigger that update on XYZ.com (if it has an API).

    console.log("Submitting time entries (server action):", JSON.stringify(entries, null, 2));
    // In a real scenario, you might be posting this data to an API endpoint of XYZ.com
    // or storing it in a database.
    
    // For demonstration, if we were updating data that getHistoricalDataAction might fetch,
    // we might want to revalidate paths that display this historical data.
    // revalidatePath('/'); // Example if page.tsx displayed historical data directly

    return { success: true, message: "Time entries processed successfully (server mock)." };
  } catch (error) {
    console.error("Error submitting time entries (server action):", error);
    return { success: false, message: "Failed to submit time entries on the server." };
  }
}


export async function getHistoricalDataAction(): Promise<{ success: boolean; message: string, data: TimeEntry[] }> {
  console.log("Attempting to fetch historical data using Python/Helium script...");

  // --- CONCEPTUAL PYTHON/HELIUM SCRIPT INVOCATION ---
  // In a real implementation, you would uncomment and use something like this:
  
  try {
    const pythonScriptPath = path.join(process.cwd(), 'src', 'scripts', 'scrape_timesheets.py');
    // Ensure Python and Helium are in the system's PATH or provide full path to python executable
    const pythonProcess = spawnSync('python', [pythonScriptPath]);

    if (pythonProcess.error) {
      console.error('Failed to start Python script:', pythonProcess.error);
      return { success: false, message: `Failed to start Python script: ${pythonProcess.error.message}`, data: [] };
    }

    if (pythonProcess.status !== 0) {
      console.error(`Python script exited with error code ${pythonProcess.status}:`);
      console.error('Stderr:', pythonProcess.stderr.toString());
      return { success: false, message: `Python script error: ${pythonProcess.stderr.toString()}`, data: [] };
    }

    const rawData = pythonProcess.stdout.toString();
    const scrapedEntries: Omit<TimeEntry, 'id'>[] = JSON.parse(rawData); // Assuming Python script outputs JSON array

    const processedData: TimeEntry[] = scrapedEntries.map(entry => ({
      ...entry,
      id: generateHistoricalEntryId(),
      Hours: Number(entry.Hours) || 0,
    }));
    
    // Further filter for the last 3 months if the Python script doesn't already do it
    const currentDate = new Date();
    const threeMonthsAgo = subMonths(currentDate, 3);
    const threeMonthFilteredData = processedData.filter(entry => {
        try {
            const entryDate = parseISO(entry.Date);
            return entryDate >= threeMonthsAgo && entryDate <= currentDate;
        } catch (e) {
            console.warn(`Could not parse date for entry: ${entry.Date}. Excluding from 3-month filter.`, e);
            return false;
        }
    });


    console.log(`Successfully fetched ${threeMonthFilteredData.length} entries via Python script.`);
    return { success: true, message: "Historical data fetched successfully via Python/Helium.", data: threeMonthFilteredData };

  } catch (error) {
    console.error("Error executing or processing Python script:", error);
    return { success: false, message: `Error processing Python script output: ${(error as Error).message}`, data: [] };
  }
  

  // --- SIMULATION USING MOCK DATA (as Python script execution is conceptual here) ---
  console.log("Using mock data as Python script execution is conceptual in this environment.");
  try {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing delay

    const currentDate = new Date();
    const threeMonthsAgo = subMonths(currentDate, 3);
    
    const filteredData = mockHistoricalDataForAI.filter(entry => {
      try {
        const entryDate = parseISO(entry.Date); 
        return entryDate >= threeMonthsAgo && entryDate <= currentDate;
      } catch (e) {
        console.warn(`Could not parse date for entry: ${entry.Date}. Excluding from 3-month filter.`, e);
        return false; 
      }
    }).map((entry) => ({
      ...entry,
      id: generateHistoricalEntryId(), 
      Hours: Number(entry.Hours) || 0, 
    }));

    if (filteredData.length === 0 && mockHistoricalDataForAI.length > 0) {
        console.warn("No historical data found for the last 3 months from mock data. As a fallback, returning all available mock data.");
        const allMockDataWithIds = mockHistoricalDataForAI.map(entry => ({
            ...entry,
            id: generateHistoricalEntryId(),
            Hours: Number(entry.Hours) || 0,
        }));
        return { success: true, message: "Simulated historical data fetch: No entries found for the last 3 months. Displaying all mock data.", data: allMockDataWithIds };
    }
    
    if (filteredData.length === 0 && mockHistoricalDataForAI.length === 0) {
      return { success: true, message: "Simulated historical data fetch: No mock data available.", data: [] };
    }

    console.log(`Simulated: Fetched ${filteredData.length} entries for the last 3 months.`);
    return { success: true, message: "Simulated historical data fetch for the last 3 months successful.", data: filteredData };

  } catch (error) {
    console.error("Error during simulated historical data processing:", error);
    const allMockDataWithIdsOnError = mockHistoricalDataForAI.map(entry => ({
        ...entry,
        id: generateHistoricalEntryId(),
        Hours: Number(entry.Hours) || 0,
    }));
    return { success: false, message: "Error in simulated data processing. Displaying all available mock data as a fallback.", data: allMockDataWithIdsOnError };
  }
}

    