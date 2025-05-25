
import Database from 'better-sqlite3';
import type { TimeEntry } from '@/types/time-entry';
import type { UserSettings, UserSettingsWithDefaults } from '@/types/settings'; // New import
import { defaultUserSettings } from '@/types/settings'; // New import
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

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      historical_data_days INTEGER DEFAULT ${defaultUserSettings.historicalDataDays},
      prompt_override_text TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user_shorthand(user_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
    );

    CREATE TABLE IF NOT EXISTS user_historical_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      user_id TEXT NOT NULL,
      client_id TEXT, 
      date TEXT NOT NULL,
      project TEXT NOT NULL,
      activity TEXT NOT NULL,
      work_item TEXT NOT NULL,
      comment TEXT,
      entry_hash TEXT NOT NULL UNIQUE, 
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_historical_user_id_date ON user_historical_entries(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_historical_entry_hash ON user_historical_entries(entry_hash);

    CREATE TABLE IF NOT EXISTS user_proposed_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      user_id TEXT NOT NULL,
      client_id TEXT NOT NULL UNIQUE, 
      date TEXT NOT NULL,
      project TEXT NOT NULL,
      activity TEXT NOT NULL,
      work_item TEXT NOT NULL,
      hours REAL NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user_shorthand(user_id)  ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
    );
    CREATE INDEX IF NOT EXISTS idx_proposed_user_id ON user_proposed_entries(user_id);
  `);
  dbInitialized = true;
}

initializeDb();

function generateEntryHash(entry: Omit<TimeEntry, 'id' | 'clientId'>): string {
  const hashableString = `${entry.Date}-${entry.Project}-${entry.Activity}-${entry.WorkItem}-${entry.Comment}-${entry.Hours}`;
  return crypto.createHash('sha256').update(hashableString).digest('hex');
}

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

// User Settings
export function getUserSettings(userId: string): UserSettingsWithDefaults {
  const stmt = db.prepare('SELECT historical_data_days, prompt_override_text FROM user_settings WHERE user_id = ?');
  const result = stmt.get(userId) as UserSettings | undefined;
  if (result) {
    return {
        historicalDataDays: result.historicalDataDays ?? defaultUserSettings.historicalDataDays, // Ensure default if DB value is null
        promptOverrideText: result.promptOverrideText === undefined ? null : result.promptOverrideText,
    };
  }
  return { ...defaultUserSettings }; // Return defaults if no settings found
}

export function saveUserSettings(userId: string, settings: Partial<UserSettings>): void {
  // Fetch existing settings to merge, or use defaults
  const existingSettings = getUserSettings(userId);
  const newSettings = { ...existingSettings, ...settings };

  // Ensure historicalDataDays is a number, even if partial settings try to set it to null/undefined
  const historicalDaysToSave = typeof newSettings.historicalDataDays === 'number' 
    ? newSettings.historicalDataDays 
    : defaultUserSettings.historicalDataDays;

  const stmt = db.prepare(`
    INSERT INTO user_settings (user_id, historical_data_days, prompt_override_text)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
    historical_data_days = excluded.historical_data_days,
    prompt_override_text = excluded.prompt_override_text,
    updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(userId, historicalDaysToSave, newSettings.promptOverrideText);
}


export function ensureUserRecordsExist(userId: string): void {
  // Ensure user_shorthand and user_main_notes exist, as user_settings depends on user_shorthand
  const currentShorthand = getShorthand(userId);
  saveShorthand(userId, currentShorthand || '');

  const currentMainNotes = getMainNotes(userId);
  saveMainNotes(userId, currentMainNotes || '');
  
  // Now ensure user_settings exists
  const currentSettings = getUserSettings(userId); // This will return defaults if not found
  // Save ensures the record is there, even if it's just defaults
  saveUserSettings(userId, currentSettings); 
}


export function getHistoricalEntries(userId: string, limitLastMonths: number | null = 3): TimeEntry[] {
  let query = 'SELECT id as sqlite_pk_id, client_id, date, project, activity, work_item, hours, comment FROM user_historical_entries WHERE user_id = ?';
  const params: any[] = [userId];

  if (limitLastMonths !== null && limitLastMonths > 0) {
    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - limitLastMonths);
    query += ' AND date >= ?';
    params.push(sinceDate.toISOString().split('T')[0]);
  }
  
  query += ' ORDER BY date DESC, sqlite_pk_id DESC';

  const stmt = db.prepare(query);
  const results = stmt.all(...params) as any[];
  
  return results.map(dbRow => {
    const row = dbRow as any; 
    return {
      id: row.client_id || `db_hist_sqpk_${row.sqlite_pk_id}`, 
      Date: row.date,
      Project: row.project,
      Activity: row.activity,
      WorkItem: row.work_item, 
      Comment: row.comment,
    };
  });
}

export function addHistoricalEntries(userId: string, entries: Omit<TimeEntry, 'Hours'>[]): void {
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
        entry.id, 
        entry.Date,
        entry.Project,
        entry.Activity,
        entry.WorkItem,
        entry.Comment,
        hash
      );
    }
  })();
}

export function getProposedEntries(userId: string): TimeEntry[] {
  const stmt = db.prepare(`
    SELECT client_id, date, project, activity, work_item, hours, comment 
    FROM user_proposed_entries 
    WHERE user_id = ? 
    ORDER BY id ASC 
  `); 
  const results = stmt.all(userId) as any[];
  return results.map(dbRow => {
    const row = dbRow as any; 
    return {
      id: row.client_id, 
      Date: row.date,
      Project: row.project,
      Activity: row.activity,
      WorkItem: row.work_item, 
      Hours: row.hours,
      Comment: row.comment,
    };
  });
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
        entry.id, 
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

export function getLatestHistoricalEntryTimestamp(userId: string): string | null {
  const stmt = db.prepare('SELECT MAX(created_at) as latest_timestamp FROM user_historical_entries WHERE user_id = ?');
  const result = stmt.get(userId) as { latest_timestamp: string } | undefined;
  return result?.latest_timestamp ?? null;
}

