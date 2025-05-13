import Database from 'better-sqlite3';
import type { TimeEntry } from '@/types/time-entry';
import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';

const DB_FILE_PATH = path.join(process.cwd(), '.data', 'chronoassist.db');

// Ensure the .data directory exists
const dataDir = path.dirname(DB_FILE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_FILE_PATH);
// console.log(`SQLite database initialized at ${DB_FILE_PATH}`);


let dbInitialized = false;

export function initializeDb() {
  if (dbInitialized) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_shorthand (
      user_id TEXT PRIMARY KEY,
      shorthand_text TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_main_notes (
      user_id TEXT PRIMARY KEY,
      notes_text TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_historical_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      client_id TEXT, -- Store client-generated ID if needed for reconciliation, can be null
      date TEXT NOT NULL,
      project TEXT NOT NULL,
      activity TEXT NOT NULL,
      work_item TEXT NOT NULL,
      hours REAL NOT NULL,
      comment TEXT,
      entry_hash TEXT NOT NULL UNIQUE, -- To prevent exact duplicates for the same user
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user_shorthand(user_id) ON DELETE CASCADE 
        DEFERRABLE INITIALLY DEFERRED, 
      FOREIGN KEY (user_id) REFERENCES user_main_notes(user_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
    );
    CREATE INDEX IF NOT EXISTS idx_historical_user_id_date ON user_historical_entries(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_historical_entry_hash ON user_historical_entries(entry_hash);


    CREATE TABLE IF NOT EXISTS user_proposed_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      client_id TEXT NOT NULL UNIQUE, -- Client-side generated ID
      date TEXT NOT NULL,
      project TEXT NOT NULL,
      activity TEXT NOT NULL,
      work_item TEXT NOT NULL,
      hours REAL NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user_shorthand(user_id)  ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,
      FOREIGN KEY (user_id) REFERENCES user_main_notes(user_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
    );
    CREATE INDEX IF NOT EXISTS idx_proposed_user_id ON user_proposed_entries(user_id);
  `);
  dbInitialized = true;
  // console.log('Database tables ensured.');
}

// Initialize DB on module load
initializeDb();

function generateEntryHash(entry: Omit<TimeEntry, 'id' | 'clientId'>): string {
  const hashableString = `${entry.Date}-${entry.Project}-${entry.Activity}-${entry.WorkItem}-${entry.Comment}-${entry.Hours}`;
  return crypto.createHash('sha256').update(hashableString).digest('hex');
}

// Shorthand Notes
export function getShorthand(userId: string): string | null {
  const stmt = db.prepare('SELECT shorthand_text FROM user_shorthand WHERE user_id = ?');
  const result = stmt.get(userId) as { shorthand_text: string } | undefined;
  return result?.shorthand_text ?? null;
}

export function saveShorthand(userId: string, text: string): void {
  const stmt = db.prepare(`
    INSERT INTO user_shorthand (user_id, shorthand_text)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
    shorthand_text = excluded.shorthand_text,
    updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(userId, text);
}

// Main Notes
export function getMainNotes(userId: string): string | null {
  const stmt = db.prepare('SELECT notes_text FROM user_main_notes WHERE user_id = ?');
  const result = stmt.get(userId) as { notes_text: string } | undefined;
  return result?.notes_text ?? null;
}

export function saveMainNotes(userId: string, text: string): void {
  const stmt = db.prepare(`
    INSERT INTO user_main_notes (user_id, notes_text)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
    notes_text = excluded.notes_text,
    updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(userId, text);
}

// Function to ensure user_id exists in parent tables (user_shorthand, user_main_notes)
export function ensureUserRecordsExist(userId: string): void {
  // Calling saveShorthand and saveMainNotes with current or empty values
  // ensures the records exist due to their UPSERT (INSERT ON CONFLICT DO UPDATE) logic.
  const currentShorthand = getShorthand(userId);
  saveShorthand(userId, currentShorthand || '');

  const currentMainNotes = getMainNotes(userId);
  saveMainNotes(userId, currentMainNotes || '');
}


// Historical Entries
export function getHistoricalEntries(userId: string, limitLastMonths: number | null = 3): TimeEntry[] {
  let query = 'SELECT client_id as id, date, project, activity, work_item, hours, comment FROM user_historical_entries WHERE user_id = ?';
  const params: any[] = [userId];

  if (limitLastMonths !== null && limitLastMonths > 0) {
    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - limitLastMonths);
    query += ' AND date >= ?';
    params.push(sinceDate.toISOString().split('T')[0]);
  }
  
  query += ' ORDER BY date DESC, id DESC';

  const stmt = db.prepare(query);
  const results = stmt.all(...params) as any[];
  return results.map(row => ({
    ...row,
    id: row.id || `db_hist_${row.id_fallback || Math.random()}` // Use client_id as id, fallback if needed
  }));
}

export function addHistoricalEntries(userId: string, entries: TimeEntry[]): void {
  const insertStmt = db.prepare(`
    INSERT INTO user_historical_entries (user_id, client_id, date, project, activity, work_item, hours, comment, entry_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(entry_hash) DO NOTHING
  `);

  db.transaction(() => {
    for (const entry of entries) {
      const hash = generateEntryHash(entry);
      insertStmt.run(
        userId,
        entry.id, // Store client-generated ID if available
        entry.Date,
        entry.Project,
        entry.Activity,
        entry.WorkItem,
        entry.Hours,
        entry.Comment,
        hash
      );
    }
  })();
}

// Proposed Entries
export function getProposedEntries(userId: string): TimeEntry[] {
  const stmt = db.prepare(`
    SELECT client_id as id, date, project, activity, work_item, hours, comment 
    FROM user_proposed_entries 
    WHERE user_id = ? 
    ORDER BY id ASC
  `); // Use client_id as id
  return stmt.all(userId) as TimeEntry[];
}

export function saveProposedEntries(userId: string, entries: TimeEntry[]): void {
  const deleteStmt = db.prepare('DELETE FROM user_proposed_entries WHERE user_id = ?');
  const insertStmt = db.prepare(`
    INSERT INTO user_proposed_entries (user_id, client_id, date, project, activity, work_item, hours, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    deleteStmt.run(userId);
    for (const entry of entries) {
      insertStmt.run(
        userId,
        entry.id, // client_id
        entry.Date,
        entry.Project,
        entry.Activity,
        entry.WorkItem,
        entry.Hours,
        entry.Comment
      );
    }
  })();
}

export function clearProposedEntries(userId: string): void {
  const stmt = db.prepare('DELETE FROM user_proposed_entries WHERE user_id = ?');
  stmt.run(userId);
}

// Utility to get the most recent historical data timestamp for a user
export function getLatestHistoricalEntryTimestamp(userId: string): string | null {
  const stmt = db.prepare('SELECT MAX(created_at) as latest_timestamp FROM user_historical_entries WHERE user_id = ?');
  const result = stmt.get(userId) as { latest_timestamp: string } | undefined;
  return result?.latest_timestamp ?? null;
}

