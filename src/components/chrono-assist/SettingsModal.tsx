
'use client';

import { useState, useEffect } from 'react';
import type { UserSettings } from '@/types/settings';
import { defaultUserSettings } from '@/types/settings';
import { initialTimeEntryAIChatPrompt as hardcodedDefaultPrompt } from '@/lib/constants'; // Import the default prompt from constants
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Cog, RotateCcw } from 'lucide-react'; // Added RotateCcw for restore icon

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: UserSettings;
  onSave: (settings: UserSettings) => void;
}

export function SettingsModal({ isOpen, onClose, currentSettings, onSave }: SettingsModalProps) {
  const [historicalDays, setHistoricalDays] = useState(defaultUserSettings.historicalDataDays);
  const [promptOverrideTextState, setPromptOverrideTextState] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setHistoricalDays(currentSettings.historicalDataDays || defaultUserSettings.historicalDataDays);
      // If promptOverrideText from DB is null (use default), show the hardcoded default prompt.
      // Otherwise, show the saved override (which could be an empty string).
      setPromptOverrideTextState(currentSettings.promptOverrideText === null ? hardcodedDefaultPrompt : currentSettings.promptOverrideText);
    }
  }, [isOpen, currentSettings]);

  const handleRestoreDefaultPrompt = () => {
    setPromptOverrideTextState(hardcodedDefaultPrompt);
  };

  const handleSave = () => {
    let promptToSave: string | null;
    // If the text in the textarea is identical to the hardcoded default prompt,
    // save null to the database, signifying "use the system's hardcoded default".
    if (promptOverrideTextState === hardcodedDefaultPrompt) {
      promptToSave = null;
    } else {
      promptToSave = promptOverrideTextState; // Save the actual text (could be empty string)
    }

    onSave({
      historicalDataDays: Number(historicalDays) || defaultUserSettings.historicalDataDays,
      promptOverrideText: promptToSave,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold flex items-center">
            <Cog className="mr-2 h-6 w-6 text-primary" />
            Application Settings
          </DialogTitle>
          <DialogDescription className="pt-2">
            Configure application behavior and AI prompt settings.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="historical-days" className="text-sm font-medium">
              Days for Historical Data Refresh
            </Label>
            <Input
              id="historical-days"
              type="number"
              value={historicalDays}
              onChange={(e) => setHistoricalDays(parseInt(e.target.value, 10))}
              placeholder={`Default: ${defaultUserSettings.historicalDataDays}`}
              className="text-sm p-3 rounded-md shadow-inner focus:ring-accent focus:border-accent"
              min="1"
              step="1"
            />
            <p className="text-xs text-muted-foreground">
              Number of past days of data to fetch when 'Refresh Data' is used.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="prompt-override" className="text-sm font-medium">
                System Prompt Override (Advanced)
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestoreDefaultPrompt}
                className="text-xs"
                aria-label="Restore default system prompt"
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Restore Default
              </Button>
            </div>
            <Textarea
              id="prompt-override"
              value={promptOverrideTextState}
              onChange={(e) => setPromptOverrideTextState(e.target.value)}
              placeholder="Enter your custom prompt here to override the default system prompt."
              rows={15} // Increased rows for better visibility of default prompt
              className="text-sm p-3 rounded-md shadow-inner focus:ring-accent focus:border-accent font-mono" // Added font-mono for prompt readability
            />
            <p className="text-xs text-muted-foreground">
              This prompt instructs the AI. Modifying it can significantly change AI behavior.
              Click "Restore Default" and save if you want to revert to the standard system prompt.
            </p>
          </div>
        </div>
        <DialogFooter className="pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
