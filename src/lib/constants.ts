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
