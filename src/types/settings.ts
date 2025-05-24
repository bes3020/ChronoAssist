
export interface UserSettings {
  historicalDataDays: number; // For Python script refresh period
  promptOverrideText: string | null;
}

export interface UserSettingsWithDefaults extends UserSettings {
  // Potentially add other settings here if needed
}

export const defaultUserSettings: UserSettings = {
  historicalDataDays: 30, // Default to 30 days for script refresh
  promptOverrideText: null,
};
