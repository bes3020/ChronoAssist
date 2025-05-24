
'use client';

import { useState, useEffect } from 'react';
import type { UserSettings } from '@/types/settings';
import { defaultUserSettings } from '@/types/settings';
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
import { Cog } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: UserSettings;
  onSave: (settings: UserSettings) => void;
}

export function SettingsModal({ isOpen, onClose, currentSettings, onSave }: SettingsModalProps) {
  const [historicalDays, setHistoricalDays] = useState(defaultUserSettings.historicalDataDays);
  const [promptOverride, setPromptOverride] = useState<string>(defaultUserSettings.promptOverrideText || '');

  useEffect(() => {
    if (isOpen) {
      setHistoricalDays(currentSettings.historicalDataDays || defaultUserSettings.historicalDataDays);
      setPromptOverride(currentSettings.promptOverrideText || '');
    }
  }, [isOpen, currentSettings]);

  const handleSave = () => {
    onSave({
      historicalDataDays: Number(historicalDays) || defaultUserSettings.historicalDataDays,
      promptOverrideText: promptOverride.trim() === '' ? null : promptOverride.trim(),
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
            <Label htmlFor="prompt-override" className="text-sm font-medium">
              System Prompt Override (Advanced)
            </Label>
            <Textarea
              id="prompt-override"
              value={promptOverride}
              onChange={(e) => setPromptOverride(e.target.value)}
              placeholder="Leave blank to use the default system prompt. Enter your custom prompt here to override."
              rows={10}
              className="text-sm p-3 rounded-md shadow-inner focus:ring-accent focus:border-accent"
            />
            <p className="text-xs text-muted-foreground">
              Allows you to customize the main instruction given to the AI. Use with caution.
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
