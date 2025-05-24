
import type { TimeEntry } from '@/types/time-entry';

// This is used by the AI flow which expects a different structure initially
export const mockHistoricalDataForAI = [
  { Date: "2024-07-15", Project: "Project Alpha", Activity: "Development", WorkItem: "Feature X", Hours: 2, Comment: "Worked on API integration for X" },
  { Date: "2024-07-15", Project: "Project Beta", Activity: "Meeting", WorkItem: "Sprint Planning", Hours: 1, Comment: "Discussed next sprint tasks for Beta" },
  { Date: "2024-07-16", Project: "Project Alpha", Activity: "Testing", WorkItem: "Bug Fixing", Hours: 3, Comment: "Resolved critical bugs in Alpha" },
  { Date: "2024-07-17", Project: "Project Gamma", Activity: "Documentation", WorkItem: "User Manual", Hours: 4, Comment: "Wrote user manual for Gamma" },
  { Date: "2024-07-18", Project: "Project Alpha", Activity: "Development", WorkItem: "Feature Y", Hours: 5, Comment: "Implemented new UI for Y" },
  { Date: "2024-07-18", Project: "Project Beta", Activity: "Support", WorkItem: "Client Call", Hours: 1.5, Comment: "Assisted client with Beta issue" },
];

export const initialTimeEntryAIChatPrompt = `You are an AI assistant designed to match user notes to time entries using historical data.

Analyze the following notes provided by the user.  If there is no date specified, use today's date: {{today}}.  If a weekday is specified, use the date relative to today for that day:
{{notes}}

{{#if shorthandNotes}}
Consider the following user-defined shorthand/abbreviations when interpreting the notes.
{{shorthandNotes}}
{{/if}}

Using the historical data below (which does not include hours, as hours are not relevant for suggesting the Project, Activity, WorkItem, or Comment), suggest possible time entries. If there is not enough information, extrapolate based on historical data.

Historical Data:
{{#each historicalData}}
Date: {{this.Date}}, Project: {{this.Project}}, Activity: {{this.Activity}}, WorkItem: {{this.WorkItem}}, Comment: {{this.Comment}}
{{/each}}

Return a JSON array of time entries that match the user notes. Make sure the "Hours" field is a number in .25 increments (you should suggest a reasonable number of hours based on the notes, e.g. default to 1 or 2 if not specified).
Ensure all entries match the historical data provided for Project, Activity, and WorkItem.  This means Project has specific Activities and Activities have specific work items.
Format your response as JSON. Do not include any additional text or markdown specifiers like \`\`\`json or \`\`\`.
`;
