// use server'

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

const TimeEntrySchema = z.object({
  Date: z.string().describe('The date of the time entry.'),
  Project: z.string().describe('The project associated with the time entry.'),
  Activity: z.string().describe('The activity performed during the time entry.'),
  WorkItem: z.string().describe('The work item associated with the time entry.'),
  Hours: z.number().describe('The number of hours spent on the time entry.'),
  Comment: z.string().describe('Any comments or notes related to the time entry.'),
});

const InitialTimeEntryInputSchema = z.object({
  notes: z.string().describe('The user provided notes for the time entry.'),
  historicalData: z.array(TimeEntrySchema).describe('The historical time entry data.'),
promptOverride: z.string().optional().describe('Override the default prompt with a custom prompt.')
});
export type InitialTimeEntryInput = z.infer<typeof InitialTimeEntryInputSchema>;

const InitialTimeEntryOutputSchema = z.array(TimeEntrySchema);
export type InitialTimeEntryOutput = z.infer<typeof InitialTimeEntryOutputSchema>;

export async function initialTimeEntry(input: InitialTimeEntryInput): Promise<InitialTimeEntryOutput> {
  return initialTimeEntryFlow(input);
}

const defaultPrompt = `You are an AI assistant designed to match user notes to time entries using historical data.

Analyze the following notes provided by the user:
{{notes}}

Using the historical data below, suggest possible time entries. If there is not enough information extrapolate based on historical data.

Historical Data:
{{#each historicalData}}
Date: {{this.Date}}, Project: {{this.Project}}, Activity: {{this.Activity}}, WorkItem: {{this.WorkItem}}, Hours: {{this.Hours}}, Comment: {{this.Comment}}
{{/each}}

Return a JSON array of time entries that match the user notes. Make sure the "Hours" field is a number.
Ensure all entries match the historical data provided for Project, Activity, and WorkItem, and extrapolate if needed.
Format your repsonse as JSON. Do not include any additional text.`;

const initialTimeEntryPrompt = ai.definePrompt({
  name: 'initialTimeEntryPrompt',
  input: {schema: InitialTimeEntryInputSchema},
  output: {schema: InitialTimeEntryOutputSchema},
  prompt: `{{#if promptOverride}}{{promptOverride}}{{else}}${defaultPrompt}{{/if}}`,
});

const initialTimeEntryFlow = ai.defineFlow(
  {
    name: 'initialTimeEntryFlow',
    inputSchema: InitialTimeEntryInputSchema,
    outputSchema: InitialTimeEntryOutputSchema,
  },
  async input => {
    const {output} = await initialTimeEntryPrompt(input);
    return output!;
  }
);
