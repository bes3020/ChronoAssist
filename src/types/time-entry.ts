export interface TimeEntry {
  id: string; // Can be client-generated (e.g., `proposed_xxx`) or DB-generated (e.g., `db_hist_xxx` or actual client_id from DB)
  Date: string;
  Project: string;
  Activity: string;
  WorkItem: string;
  Hours: number;
  Comment: string;
  submissionError?: string; // New field for submission errors
}
