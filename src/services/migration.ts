import type { ProviderConfig } from '../types';
import { PROVIDER_CONFIGS_KEY, storeProviderConfigs } from './providerConfig';

const APP_MIGRATION_VERSION_KEY = 'app_migration_version';
const CURRENT_MIGRATION_VERSION = 1;

function getMigrationVersion(): number {
  const raw = localStorage.getItem(APP_MIGRATION_VERSION_KEY);
  const parsed = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function setMigrationVersion(version: number): void {
  localStorage.setItem(APP_MIGRATION_VERSION_KEY, String(version));
}

function migrateToV1(): void {
  const existingConfigsRaw = localStorage.getItem(PROVIDER_CONFIGS_KEY);
  if (existingConfigsRaw) return;

  const githubToken = localStorage.getItem('github_token');
  if (!githubToken) return;

  const initialConfigs: ProviderConfig[] = [
    {
      provider: 'copilot',
      enabled: true,
      label: 'GitHub Copilot',
      tokenStorageKey: 'github_token',
    },
  ];

  storeProviderConfigs(initialConfigs);
}

export function runMigrations(): void {
  const currentVersion = getMigrationVersion();

  if (currentVersion < 1) {
    migrateToV1();
    setMigrationVersion(1);
  }

  if (getMigrationVersion() < CURRENT_MIGRATION_VERSION) {
    setMigrationVersion(CURRENT_MIGRATION_VERSION);
  }
}
