/**
 * Settings Tab Content
 * Enable toggle, port, account type, rate limiting, daemon settings
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SettingsTabProps {
  enabled: boolean;
  autoStart: boolean;
  port: number;
  accountType: 'individual' | 'business' | 'enterprise';
  rateLimit: string;
  waitOnLimit: boolean;
  onUpdateEnabled: (value: boolean) => void;
  onUpdateAutoStart: (value: boolean) => void;
  onUpdatePort: (value: number) => void;
  onUpdateAccountType: (value: 'individual' | 'business' | 'enterprise') => void;
  onUpdateRateLimit: (value: string) => void;
  onUpdateWaitOnLimit: (value: boolean) => void;
}

export function SettingsTab({
  enabled,
  autoStart,
  port,
  accountType,
  rateLimit,
  waitOnLimit,
  onUpdateEnabled,
  onUpdateAutoStart,
  onUpdatePort,
  onUpdateAccountType,
  onUpdateRateLimit,
  onUpdateWaitOnLimit,
}: SettingsTabProps) {
  return (
    <TabsContent
      value="settings"
      className="flex-1 mt-0 border-0 p-0 data-[state=inactive]:hidden flex flex-col overflow-hidden"
    >
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="enabled" className="text-sm font-medium">
                Enable Copilot
              </Label>
              <p className="text-xs text-muted-foreground">
                Allow using GitHub Copilot subscription
              </p>
            </div>
            <Switch id="enabled" checked={enabled} onCheckedChange={onUpdateEnabled} />
          </div>

          {/* Basic Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Basic Settings</h3>

            {/* Port */}
            <div className="space-y-2">
              <Label htmlFor="port" className="text-xs">
                Port
              </Label>
              <Input
                id="port"
                type="number"
                value={port}
                onChange={(e) => onUpdatePort(parseInt(e.target.value, 10))}
                min={1024}
                max={65535}
                className="max-w-[150px] h-8"
              />
            </div>

            {/* Account Type */}
            <div className="space-y-2">
              <Label htmlFor="account-type" className="text-xs">
                Account Type
              </Label>
              <Select value={accountType} onValueChange={onUpdateAccountType}>
                <SelectTrigger id="account-type" className="max-w-[150px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Rate Limiting */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Rate Limiting</h3>

            <div className="space-y-2">
              <Label htmlFor="rate-limit" className="text-xs">
                Rate Limit (seconds)
              </Label>
              <Input
                id="rate-limit"
                type="number"
                value={rateLimit}
                onChange={(e) => onUpdateRateLimit(e.target.value)}
                placeholder="No limit"
                min={0}
                className="max-w-[150px] h-8"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="wait-on-limit" className="text-xs">
                  Wait on Rate Limit
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Wait instead of error when limit hit
                </p>
              </div>
              <Switch
                id="wait-on-limit"
                checked={waitOnLimit}
                onCheckedChange={onUpdateWaitOnLimit}
              />
            </div>
          </div>

          <Separator />

          {/* Daemon Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Daemon Settings</h3>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="auto-start" className="text-xs">
                  Auto-start Daemon
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Start copilot-api when using profile
                </p>
              </div>
              <Switch id="auto-start" checked={autoStart} onCheckedChange={onUpdateAutoStart} />
            </div>
          </div>
        </div>
      </ScrollArea>
    </TabsContent>
  );
}
