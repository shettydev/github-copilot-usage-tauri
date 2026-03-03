import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ClaudeProviderConfig, ClaudeUsage, CopilotUsage, ProviderConfig, ProviderType } from '../types';
import { fetchCopilotUsage, getStoredToken, storeToken } from '../services/copilot';
import { fetchClaudeApiUsage, incrementClaudeProUsage, readClaudeProUsage, validateAnthropicKey } from '../services/claude';
import { deleteAnthropicApiKey, getAnthropicApiKey, storeAnthropicApiKey } from '../services/secrets';
import { getStoredProviderConfigs, removeProviderConfig, upsertProviderConfig } from '../services/providerConfig';

type ProviderLoading = Record<ProviderType, boolean>;
type ProviderErrors = Record<ProviderType, string | null>;

type ProviderContextType = {
  providers: ProviderConfig[];
  copilotUsage: CopilotUsage | null;
  claudeUsage: ClaudeUsage | null;
  loading: ProviderLoading;
  errors: ProviderErrors;
  refreshAll: () => Promise<void>;
  refreshProvider: (provider: ProviderType) => Promise<void>;
  setCopilotToken: (token: string) => Promise<void>;
  clearCopilotToken: () => void;
  configureClaudeApiKey: (apiKey: string) => Promise<void>;
  configureClaudePro: (plan: 'pro' | 'max' | 'team', userDefinedLimit: number | null, periodResetDay: number) => void;
  clearClaudeConfig: () => Promise<void>;
  trackClaudeProRequest: () => void;
};

const ProviderContext = createContext<ProviderContextType | null>(null);

const initialLoading: ProviderLoading = {
  copilot: false,
  claude: false,
};

const initialErrors: ProviderErrors = {
  copilot: null,
  claude: null,
};

function ensureCopilotConfig(): ProviderConfig {
  return {
    provider: 'copilot',
    enabled: true,
    label: 'GitHub Copilot',
    tokenStorageKey: 'github_token',
  };
}

function isEnabledClaudeConfig(config: ProviderConfig): config is ClaudeProviderConfig {
  return config.provider === 'claude' && config.enabled;
}

function isProClaudeConfig(config: ProviderConfig): config is ClaudeProviderConfig {
  return config.provider === 'claude' && config.enabled && config.mode === 'pro';
}

export const ProviderProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [providers, setProviders] = useState<ProviderConfig[]>(() => getStoredProviderConfigs());
  const [copilotUsage, setCopilotUsage] = useState<CopilotUsage | null>(null);
  const [claudeUsage, setClaudeUsage] = useState<ClaudeUsage | null>(null);
  const [loading, setLoading] = useState<ProviderLoading>(initialLoading);
  const [errors, setErrors] = useState<ProviderErrors>(initialErrors);

  const setProviderLoading = useCallback((provider: ProviderType, value: boolean) => {
    setLoading((prev) => ({ ...prev, [provider]: value }));
  }, []);

  const setProviderError = useCallback((provider: ProviderType, value: string | null) => {
    setErrors((prev) => ({ ...prev, [provider]: value }));
  }, []);

  const refreshProvider = useCallback(async (provider: ProviderType) => {
    if (provider === 'copilot') {
      const token = getStoredToken();
      if (!token) {
        setCopilotUsage(null);
        setProviderError('copilot', null);
        return;
      }

      setProviderLoading('copilot', true);
      setProviderError('copilot', null);

      try {
        const usage = await fetchCopilotUsage(token);
        setCopilotUsage(usage);
      } catch (error) {
        setProviderError('copilot', error instanceof Error ? error.message : 'Failed to refresh Copilot usage');
      } finally {
        setProviderLoading('copilot', false);
      }

      return;
    }

    const claudeConfig = providers.find(isEnabledClaudeConfig);
    if (!claudeConfig) {
      setClaudeUsage(null);
      setProviderError('claude', null);
      return;
    }

    setProviderLoading('claude', true);
    setProviderError('claude', null);

    try {
      if (claudeConfig.mode === 'api') {
        const apiKey = await getAnthropicApiKey();
        if (!apiKey) {
          throw new Error('Claude API key is not configured.');
        }

        const usage = await fetchClaudeApiUsage(apiKey);
        setClaudeUsage({ mode: 'api', data: usage });
      } else {
        const usage = readClaudeProUsage(
          claudeConfig.periodResetDay ?? 1,
          claudeConfig.plan ?? null,
          claudeConfig.userDefinedLimit ?? null,
        );
        setClaudeUsage({ mode: 'pro', data: usage });
      }
    } catch (error) {
      setProviderError('claude', error instanceof Error ? error.message : 'Failed to refresh Claude usage');
    } finally {
      setProviderLoading('claude', false);
    }
  }, [providers, setProviderError, setProviderLoading]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshProvider('copilot'),
      refreshProvider('claude'),
    ]);
  }, [refreshProvider]);

  const setCopilotToken = useCallback(async (token: string) => {
    const trimmed = token.trim();
    if (!trimmed) return;

    storeToken(trimmed);
    const next = upsertProviderConfig(ensureCopilotConfig());
    setProviders(next);
    await refreshProvider('copilot');
  }, [refreshProvider]);

  const clearCopilotToken = useCallback(() => {
    localStorage.removeItem('github_token');
    const next = removeProviderConfig('copilot');
    setProviders(next);
    setCopilotUsage(null);
    setProviderError('copilot', null);
  }, [setProviderError]);

  const configureClaudeApiKey = useCallback(async (apiKey: string) => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      throw new Error('Claude API key cannot be empty.');
    }

    const isValid = await validateAnthropicKey(trimmed);
    if (!isValid) {
      throw new Error('Anthropic API key validation failed.');
    }

    await storeAnthropicApiKey(trimmed);

    const next = upsertProviderConfig({
      provider: 'claude',
      enabled: true,
      label: 'Claude API',
      mode: 'api',
      apiKeyStored: true,
    });

    setProviders(next);
    await refreshProvider('claude');
  }, [refreshProvider]);

  const configureClaudePro = useCallback((plan: 'pro' | 'max' | 'team', userDefinedLimit: number | null, periodResetDay: number) => {
    const next = upsertProviderConfig({
      provider: 'claude',
      enabled: true,
      label: 'Claude Pro/Max/Team',
      mode: 'pro',
      apiKeyStored: false,
      plan,
      userDefinedLimit: userDefinedLimit ?? undefined,
      periodResetDay,
    });

    setProviders(next);
    const usage = readClaudeProUsage(periodResetDay, plan, userDefinedLimit);
    setClaudeUsage({ mode: 'pro', data: usage });
    setProviderError('claude', null);
  }, [setProviderError]);

  const clearClaudeConfig = useCallback(async () => {
    let deleteError: string | null = null;
    try {
      await deleteAnthropicApiKey();
    } catch (error) {
      deleteError = error instanceof Error ? error.message : 'Failed to delete stored Claude API key from keyring';
    }

    const next = removeProviderConfig('claude');
    setProviders(next);
    setClaudeUsage(null);
    setProviderError('claude', deleteError);
  }, [setProviderError]);

  const trackClaudeProRequest = useCallback(() => {
    const cfg = providers.find(isProClaudeConfig);
    if (!cfg) return;

    const usage = incrementClaudeProUsage(
      cfg.periodResetDay ?? 1,
      cfg.plan ?? null,
      cfg.userDefinedLimit ?? null,
    );

    setClaudeUsage({ mode: 'pro', data: usage });
  }, [providers]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const value = useMemo<ProviderContextType>(() => ({
    providers,
    copilotUsage,
    claudeUsage,
    loading,
    errors,
    refreshAll,
    refreshProvider,
    setCopilotToken,
    clearCopilotToken,
    configureClaudeApiKey,
    configureClaudePro,
    clearClaudeConfig,
    trackClaudeProRequest,
  }), [
    providers,
    copilotUsage,
    claudeUsage,
    loading,
    errors,
    refreshAll,
    refreshProvider,
    setCopilotToken,
    clearCopilotToken,
    configureClaudeApiKey,
    configureClaudePro,
    clearClaudeConfig,
    trackClaudeProRequest,
  ]);

  return <ProviderContext.Provider value={value}>{children}</ProviderContext.Provider>;
};

export function useProviders(): ProviderContextType {
  const context = useContext(ProviderContext);
  if (!context) {
    throw new Error('useProviders must be used within ProviderProvider');
  }
  return context;
}
