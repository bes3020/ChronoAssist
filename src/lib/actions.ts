'use server';
import type { InitialTimeEntryInput, InitialTimeEntryOutput } from '@/ai/flows/initial-time-entry-prompt';
import { initialTimeEntry } from '@/ai/flows/initial-time-entry-prompt';
import { revalidatePath } from 'next/cache';
import type { TimeEntry } from '@/types/time-entry';
import { mockHistoricalDataForAI } from '@/lib/constants';
import { subMonths, parseISO } from 'date-fns';

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
    // Fetch historical data for the AI to use. For this action, we'll use the local/mock data.
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
  console.log("Attempting to fetch historical data as described by scraping XYZ.com...");

  // STEP 1: Navigate to XYZ.com
  // In a real scenario, this would involve using a headless browser (e.g., Puppeteer, Playwright)
  // to open the URL. This is not possible directly within a standard Next.js server action
  // without significant additional setup (e.g., a separate microservice or running Puppeteer locally
  // if the Next.js app is not serverless).
  console.log("Conceptual step 1: Navigating to XYZ.com (Not actually performed by this server action)");

  // STEP 2: Wait for the user to login
  // Server actions are generally stateless and cannot "wait" for user interaction in a browser page.
  // Authentication for scraping typically relies on the server action receiving necessary
  // session cookies or API tokens with the request, assuming the user has already logged in elsewhere.
  console.log("Conceptual step 2: Assuming user is logged in (Authentication would be pre-handled via cookies/tokens)");

  // STEP 3: Click on the timesheets button
  // This would require a CSS selector for the button and browser automation to click it.
  // For example, with Puppeteer: await page.click('#timesheets-button-selector');
  console.log("Conceptual step 3: Clicking 'timesheets' button (Not actually performed)");

  // STEP 4: Capture all data in the grid for 3 months by scrolling down
  // This is the most complex part, involving:
  // - Identifying CSS selectors for the grid, rows, and individual data cells.
  // - Implementing scrolling logic (e.g., `page.evaluate(() => window.scrollBy(0, window.innerHeight))`).
  // - Parsing HTML content from the grid as it loads.
  // - Handling pagination or infinite scroll until 3 months of data are collected.
  // - Stopping condition: Check the date of the entries to ensure only the last 3 months are fetched.
  console.log("Conceptual step 4: Capturing grid data for 3 months with scrolling (Not actually performed)");

  // --- SIMULATION OF DATA FETCHING ---
  // Since actual web scraping is not implemented in this server action,
  // we will use the existing `mockHistoricalDataForAI` and simulate filtering for the last 3 months.
  // In a real implementation, the data would come from the scraping process described above.
  try {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay for fetching

    const currentDate = new Date();
    const threeMonthsAgo = subMonths(currentDate, 3);
    
    const filteredData = mockHistoricalDataForAI.filter(entry => {
      try {
        const entryDate = parseISO(entry.Date); // Assumes entry.Date is 'YYYY-MM-DD'
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

    console.log(`Simulated: Fetched ${filteredData.length} entries conceptually from XYZ.com for the last 3 months.`);
    return { success: true, message: "Simulated historical data fetch for the last 3 months successful.", data: filteredData };

  } catch (error) {
    console.error("Error during simulated historical data processing:", error);
    // Fallback to returning all mock data if there's an error in simulation logic itself
     const allMockDataWithIdsOnError = mockHistoricalDataForAI.map(entry => ({
        ...entry,
        id: generateHistoricalEntryId(),
        Hours: Number(entry.Hours) || 0,
    }));
    return { success: false, message: "Error in simulated data processing. Displaying all available mock data as a fallback.", data: allMockDataWithIdsOnError };
  }
}