
// use server' // Note: This line had a typo, should be 'use server';

/**
 * @fileOverview This file defines a Genkit flow for matching user notes to time entries.
 *
 * - initialTimeEntry - A function that takes user notes and historical data to match time entries.
 * - InitialTimeEntryInput - The input type for the initialTimeEntry function.
 * - InitialTimeEntryOutput - The return type for the initialTimeEntry function.
 */

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { initialTimeEntryAIChatPrompt } from '@/lib/constants'; // Import the prompt

// This schema defines the structure of historical time entries *as expected by the AI prompt*.
// Hours are removed from here as they are not needed for AI suggestion context.
const HistoricalTimeEntrySchemaForAI = z.object({
  Date: z.string().describe('The date of the time entry.'),
  Project: z.string().describe('The project associated with the time entry.'),
  Activity: z.string().describe('The activity performed during the time entry.'),
  WorkItem: z.string().describe('The work item associated with the time entry.'),
  Comment: z.string().describe('Any comments or notes related to the time entry.'),
});

const InitialTimeEntryInputSchema = z.object({
  notes: z.string().describe('The user provided notes for the time entry.'),
  historicalData: z.array(HistoricalTimeEntrySchemaForAI).describe('The historical time entry data (excluding hours).'),
  promptOverride: z.string().optional().describe('Override the default prompt with a custom prompt.'),
  shorthandNotes: z.string().optional().describe('User-defined shorthand or common abbreviations to help interpret notes.'),
});
export type InitialTimeEntryInput = z.infer<typeof InitialTimeEntryInputSchema>;

// This schema defines the structure of the *output* from the AI, which *will* include hours.
const OutputTimeEntrySchema = z.object({
  Date: z.string().describe('The date of the time entry.'),
  Project: z.string().describe('The project associated with the time entry.'),
  Activity: z.string().describe('The activity performed during the time entry.'),
  WorkItem: z.string().describe('The work item associated with the time entry.'),
  Hours: z.number().describe('The number of hours spent on the time entry.'),
  Comment: z.string().describe('Any comments or notes related to the time entry.'),
});
const InitialTimeEntryOutputSchema = z.array(OutputTimeEntrySchema);
export type InitialTimeEntryOutput = z.infer<typeof InitialTimeEntryOutputSchema>;

export async function initialTimeEntry(input: InitialTimeEntryInput): Promise<InitialTimeEntryOutput> {
  return initialTimeEntryFlow(input);
}

const initialTimeEntryPrompt = ai.definePrompt({
  name: 'initialTimeEntryPrompt',
  input: {schema: InitialTimeEntryInputSchema},
  output: {schema: InitialTimeEntryOutputSchema},
  prompt: `{{#if promptOverride}}{{promptOverride}}{{else}}${initialTimeEntryAIChatPrompt}{{/if}}`,
});

const initialTimeEntryFlow = ai.defineFlow(
  {
    name: 'initialTimeEntryFlow',
    inputSchema: InitialTimeEntryInputSchema,
    outputSchema: InitialTimeEntryOutputSchema,
  },
  async input => {
    // Add today's date to the input in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Merge the input with the today variable
    const enrichedInput = { ...input, today };
    
    const {output} = await initialTimeEntryPrompt(enrichedInput);
    console.log('AI output:', output);
    // Ensure output is always an array, even if AI fails to produce valid JSON or returns null/undefined
    if (!output || !Array.isArray(output)) {
      console.warn('AI did not return a valid array. Returning empty array. Output:', output);
      return [];
    }
    return output;
  }
);
