'use server';

/**
 * @fileOverview AI agent for matching time entries to historical data.
 *
 * - matchTimeEntry - A function that matches time entries based on user notes and historical data.
 * - MatchTimeEntryInput - The input type for the matchTimeEntry function.
 * - MatchTimeEntryOutput - The return type for the matchTimeEntry function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MatchTimeEntryInputSchema = z.object({
  notes: z.string().describe('The user-provided notes for the time entry.'),
  historicalData: z
    .string()
    .describe('Historical time entry data as a string.'),
  date: z.string().describe('The date of the time entry.'),
});
export type MatchTimeEntryInput = z.infer<typeof MatchTimeEntryInputSchema>;

const MatchTimeEntryOutputSchema = z.object({
  project: z.string().describe('The suggested project based on the notes.'),
  activity: z.string().describe('The suggested activity based on the notes.'),
  workItem: z.string().describe('The suggested work item based on the notes.'),
  confidence: z
    .number()
    .describe('A confidence score (0-1) indicating the accuracy of the match.'),
});
export type MatchTimeEntryOutput = z.infer<typeof MatchTimeEntryOutputSchema>;

export async function matchTimeEntry(input: MatchTimeEntryInput): Promise<MatchTimeEntryOutput> {
  return matchTimeEntryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'matchTimeEntryPrompt',
  input: {schema: MatchTimeEntryInputSchema},
  output: {schema: MatchTimeEntryOutputSchema},
  prompt: `Given the following notes and historical time entry data, suggest the most likely Project, Activity, and WorkItem for the time entry.

Notes: {{{notes}}}

Historical Data: {{{historicalData}}}

Date: {{{date}}}

Project: {{project}}
Activity: {{activity}}
WorkItem: {{workItem}}
Confidence: {{confidence}}`,
});

const matchTimeEntryFlow = ai.defineFlow(
  {
    name: 'matchTimeEntryFlow',
    inputSchema: MatchTimeEntryInputSchema,
    outputSchema: MatchTimeEntryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
