export { HomePage } from './home';

export { ApiPage } from './api';

export function CliproxyPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">CLIProxy</h1>
      <p className="mt-4 text-muted-foreground">OAuth provider management (Phase 03)</p>
    </div>
  );
}

export function AccountsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Accounts</h1>
      <p className="mt-4 text-muted-foreground">Multi-account management (Phase 03)</p>
    </div>
  );
}

export { SettingsPage } from './settings';

export { HealthPage } from './health';

export { SharedPage } from './shared';
