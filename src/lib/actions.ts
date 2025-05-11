'use server';
import type { InitialTimeEntryInput, InitialTimeEntryOutput } from '@/ai/flows/initial-time-entry-prompt';
import { initialTimeEntry } from '@/ai/flows/initial-time-entry-prompt';
import type { TimeEntry } from '@/types/time-entry';
import { mockHistoricalDataForAI } from '@/lib/constants';

// Helper to generate unique IDs for client-side rendering
let idCounter = 0;
const generateId = () => `entry_${Date.now()}_${idCounter++}`;

export async function getProposedEntriesAction(notes: string): Promise<TimeEntry[]> {
  if (!notes.trim()) {
    return [];
  }

  try {
    const aiInput: InitialTimeEntryInput = {
      notes,
      historicalData: mockHistoricalDataForAI,
    };
    const aiOutput: InitialTimeEntryOutput = await initialTimeEntry(aiInput);

    // Transform AI output to TimeEntry[] and add unique IDs
    const proposedEntries: TimeEntry[] = aiOutput.map(entry => ({
      ...entry,
      id: generateId(), 
      Hours: Number(entry.Hours) || 0, // Ensure Hours is a number
    }));
    
    return proposedEntries;

  } catch (error) {
    console.error("Error getting proposed entries from AI:", error);
    // Consider re-throwing a more user-friendly error or returning an error object
    throw new Error("Failed to generate time entry suggestions. Please try again.");
  }
}

export async function submitTimeEntriesAction(entries: TimeEntry[]): Promise<{ success: boolean; message: string }> {
  console.log("Submitting time entries (mock):", JSON.stringify(entries, null, 2));
  // Placeholder for browser automation logic
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
  return { success: true, message: "Time entries submitted successfully (mock)." };
}

export async function getHistoricalDataAction(): Promise<{ success: boolean; message: string, data: unknown[] }> {
  console.log("Fetching historical data (mock)...");
  // Placeholder for browser automation logic to fetch historical data
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
  return { success: true, message: "Historical data fetched successfully (mock).", data: mockHistoricalDataForAI };
}
