import type { CopilotProviderConfig, ProviderConfig, ProviderType } from '../types';

export const PROVIDER_CONFIGS_KEY = 'provider_configs';

const defaultCopilotConfig: CopilotProviderConfig = {
  provider: 'copilot',
  enabled: true,
  label: 'GitHub Copilot',
  tokenStorageKey: 'github_token',
};

function isProviderType(value: unknown): value is ProviderType {
  return value === 'copilot' || value === 'claude';
}

function normalizeProviderConfig(value: unknown): ProviderConfig | null {
  if (!value || typeof value !== 'object') return null;

  const cfg = value as {
    provider?: unknown;
    enabled?: unknown;
    label?: unknown;
    mode?: unknown;
    apiKeyStored?: unknown;
    plan?: unknown;
    userDefinedLimit?: unknown;
    periodResetDay?: unknown;
  };

  if (!isProviderType(cfg.provider)) return null;

  const enabled = typeof cfg.enabled === 'boolean' ? cfg.enabled : true;
  const label = typeof cfg.label === 'string' && cfg.label.trim() ? cfg.label : cfg.provider === 'copilot' ? 'GitHub Copilot' : 'Claude';

  if (cfg.provider === 'copilot') {
    return {
      provider: 'copilot',
      enabled,
      label,
      tokenStorageKey: 'github_token',
    };
  }

  const mode = cfg.mode === 'pro' ? 'pro' : 'api';
  const apiKeyStored = typeof cfg.apiKeyStored === 'boolean' ? cfg.apiKeyStored : false;
  const plan = cfg.plan === 'pro' || cfg.plan === 'max' || cfg.plan === 'team' ? cfg.plan : undefined;
  const userDefinedLimit = typeof cfg.userDefinedLimit === 'number' ? cfg.userDefinedLimit : undefined;
  const periodResetDay = typeof cfg.periodResetDay === 'number' ? cfg.periodResetDay : undefined;

  return {
    provider: 'claude',
    enabled,
    label,
    mode,
    apiKeyStored,
    plan,
    userDefinedLimit,
    periodResetDay,
  };
}

export function getDefaultProviderConfigs(): ProviderConfig[] {
  const hasGitHubToken = Boolean(localStorage.getItem('github_token'));
  return hasGitHubToken ? [defaultCopilotConfig] : [];
}

export function getStoredProviderConfigs(): ProviderConfig[] {
  const raw = localStorage.getItem(PROVIDER_CONFIGS_KEY);
  if (!raw) return getDefaultProviderConfigs();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return getDefaultProviderConfigs();

    const normalized = parsed
      .map(normalizeProviderConfig)
      .filter((item): item is ProviderConfig => item !== null);

    return normalized.length ? normalized : getDefaultProviderConfigs();
  } catch {
    return getDefaultProviderConfigs();
  }
}

export function storeProviderConfigs(configs: ProviderConfig[]): void {
  localStorage.setItem(PROVIDER_CONFIGS_KEY, JSON.stringify(configs));
}

export function upsertProviderConfig(config: ProviderConfig): ProviderConfig[] {
  const current = getStoredProviderConfigs();
  const next = current.filter((cfg) => cfg.provider !== config.provider);
  next.push(config);
  storeProviderConfigs(next);
  return next;
}

export function removeProviderConfig(provider: ProviderType): ProviderConfig[] {
  const next = getStoredProviderConfigs().filter((cfg) => cfg.provider !== provider);
  storeProviderConfigs(next);
  return next;
}
