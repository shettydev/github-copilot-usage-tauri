import { useCallback, useEffect, useMemo, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { sendNotification } from '@tauri-apps/plugin-notification';
import ProgressBar from './components/ProgressBar';
import { completeAuthFlow, startAuthFlow, closeAuthServer } from './services/auth';
import { calculatePercentage, getStoredToken } from './services/copilot';
import { useTray } from './contexts/TrayContext';
import { useProviders } from './contexts/ProviderContext';
import type { ClaudeProviderConfig } from './types';
import './App.css';

const REFRESH_OPTIONS = [1, 5, 15, 30];

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function numberInputToNullable(raw: string): number | null {
  if (!raw.trim()) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function App() {
  const {
    providers,
    copilotUsage,
    claudeUsage,
    loading,
    errors,
    refreshAll,
    setCopilotToken,
    clearCopilotToken,
    configureClaudeApiKey,
    configureClaudePro,
    clearClaudeConfig,
    trackClaudeProRequest,
  } = useProviders();
  const { setText, updateMenu } = useTray();

  const [tokenInput, setTokenInput] = useState<string>(() => getStoredToken() ?? '');
  const [claudeApiKeyInput, setClaudeApiKeyInput] = useState('');
  const [claudePlanInput, setClaudePlanInput] = useState<'pro' | 'max' | 'team'>('pro');
  const [claudeLimitInput, setClaudeLimitInput] = useState('');
  const [claudeResetDayInput, setClaudeResetDayInput] = useState('1');
  const [savingCopilot, setSavingCopilot] = useState(false);
  const [savingClaudeApi, setSavingClaudeApi] = useState(false);
  const [savingClaudePro, setSavingClaudePro] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [showBar, setShowBar] = useState<boolean>(() => {
    const v = localStorage.getItem('showBar');
    return v === null ? true : v === '1';
  });
  const [showPercent, setShowPercent] = useState<boolean>(() => {
    const v = localStorage.getItem('showPercent');
    return v === null ? true : v === '1';
  });
  const [refreshInterval, setRefreshInterval] = useState<number>(() => {
    const v = localStorage.getItem('refreshInterval');
    const n = v ? parseInt(v, 10) : 5;
    return REFRESH_OPTIONS.includes(n) ? n : 5;
  });

  const [userCode, setUserCode] = useState<string>('');
  const [authState, setAuthState] = useState<{
    userCode: string;
    verificationUri: string;
    deviceCode: string;
    interval: number;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const claudeConfig = useMemo(
    () => providers.find((provider): provider is ClaudeProviderConfig => provider.provider === 'claude' && provider.enabled),
    [providers],
  );

  const copilotPercentage = useMemo(
    () => (copilotUsage ? calculatePercentage(copilotUsage.premium_requests_used, copilotUsage.premium_requests_limit) : 0),
    [copilotUsage],
  );

  const claudeIndicatorPercent = useMemo(() => {
    if (!claudeUsage) return 0;

    if (claudeUsage.mode === 'api') {
      const reqLimit = claudeUsage.data.requests_limit;
      const reqRemaining = claudeUsage.data.requests_remaining;
      if (typeof reqLimit === 'number' && typeof reqRemaining === 'number') {
        return calculatePercentage(Math.max(0, reqLimit - reqRemaining), reqLimit);
      }
      return 0;
    }

    if (typeof claudeUsage.data.user_defined_limit === 'number') {
      return calculatePercentage(claudeUsage.data.requests_made, claudeUsage.data.user_defined_limit);
    }

    return 0;
  }, [claudeUsage]);

  const defaultIndicatorPercent = useMemo(() => {
    if (copilotUsage) return copilotPercentage;
    if (claudeUsage) return claudeIndicatorPercent;
    return 0;
  }, [copilotUsage, copilotPercentage, claudeUsage, claudeIndicatorPercent]);

  const checkAndNotify = useCallback(() => {
    if (!copilotUsage) return;
    const key = copilotUsage.billing_cycle_end;
    const pct = calculatePercentage(copilotUsage.premium_requests_used, copilotUsage.premium_requests_limit);
    const k90 = `notified_90_${key}`;
    const k80 = `notified_80_${key}`;

    if (pct >= 90 && !localStorage.getItem(k90)) {
      sendNotification({
        title: 'Copilot Quota Alert',
        body: `90% of premium requests used (${copilotUsage.premium_requests_used}/${copilotUsage.premium_requests_limit})`,
      });
      localStorage.setItem(k90, '1');
      return;
    }

    if (pct >= 80 && !localStorage.getItem(k80)) {
      sendNotification({
        title: 'Copilot Quota Alert',
        body: `80% of premium requests used (${copilotUsage.premium_requests_used}/${copilotUsage.premium_requests_limit})`,
      });
      localStorage.setItem(k80, '1');
    }
  }, [copilotUsage]);

  useEffect(() => {
    checkAndNotify();
  }, [checkAndNotify]);

  useEffect(() => {
    const timer = setInterval(() => {
      refreshAll();
    }, refreshInterval * 60 * 1000);

    return () => clearInterval(timer);
  }, [refreshAll, refreshInterval]);

  useEffect(() => {
    localStorage.setItem('showBar', showBar ? '1' : '0');
  }, [showBar]);

  useEffect(() => {
    localStorage.setItem('showPercent', showPercent ? '1' : '0');
  }, [showPercent]);

  useEffect(() => {
    localStorage.setItem('refreshInterval', String(refreshInterval));
  }, [refreshInterval]);

  useEffect(() => {
    const totalBlocks = 5;
    const pct = clampPercentage(defaultIndicatorPercent);
    const filledBlocks = Math.round(((100 - pct) / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    const progressBar = '▰'.repeat(filledBlocks) + '▱'.repeat(emptyBlocks);
    const percentText = `${pct}%`;

    let text = '';
    if (showBar) text += progressBar;
    if (showBar && showPercent) text += ' ';
    if (showPercent) text += percentText;

    setText(` ${text}`);
  }, [defaultIndicatorPercent, setText, showBar, showPercent]);

  useEffect(() => {
    const usageInfo = {
      copilot: copilotUsage
        ? {
            premiumUsed: copilotUsage.premium_requests_used,
            premiumLimit: copilotUsage.premium_requests_limit,
            premiumRemaining: Math.max(0, copilotUsage.premium_requests_limit - copilotUsage.premium_requests_used),
          }
        : undefined,
      claude: claudeUsage
        ? claudeUsage.mode === 'api'
          ? {
              mode: 'api' as const,
              label: 'Claude API',
              requestsUsed:
                typeof claudeUsage.data.requests_limit === 'number' && typeof claudeUsage.data.requests_remaining === 'number'
                  ? Math.max(0, claudeUsage.data.requests_limit - claudeUsage.data.requests_remaining)
                  : undefined,
              requestsLimit: claudeUsage.data.requests_limit ?? undefined,
              requestsRemaining: claudeUsage.data.requests_remaining ?? undefined,
              inputTokensUsed: claudeUsage.data.input_tokens_used,
              inputTokensLimit: claudeUsage.data.input_tokens_limit ?? undefined,
              inputTokensRemaining: claudeUsage.data.input_tokens_remaining ?? undefined,
              outputTokensUsed: claudeUsage.data.output_tokens_used,
              outputTokensLimit: claudeUsage.data.output_tokens_limit ?? undefined,
              outputTokensRemaining: claudeUsage.data.output_tokens_remaining ?? undefined,
              periodEnd: claudeUsage.data.requests_reset ?? undefined,
            }
          : {
              mode: 'pro' as const,
              label: `Claude ${claudeUsage.data.plan ? claudeUsage.data.plan.toUpperCase() : 'Pro/Max/Team'} (App-tracked)`,
              requestsUsed: claudeUsage.data.requests_made,
              requestsLimit: claudeUsage.data.user_defined_limit ?? undefined,
              requestsRemaining:
                typeof claudeUsage.data.user_defined_limit === 'number'
                  ? Math.max(0, claudeUsage.data.user_defined_limit - claudeUsage.data.requests_made)
                  : undefined,
              periodEnd: claudeUsage.data.period_end,
            }
        : undefined,
    };

    const hasUsage = Boolean(usageInfo.copilot || usageInfo.claude);
    updateMenu(hasUsage ? usageInfo : null, refreshAll);
  }, [claudeUsage, copilotUsage, refreshAll, updateMenu]);

  const startPollingForToken = useCallback(
    async (deviceCode: string, intervalSeconds = 5, attempts = 0) => {
      try {
        const authToken = await completeAuthFlow(deviceCode);
        setTokenInput(authToken);
        await setCopilotToken(authToken);
        setUserCode('');
        setAuthState(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isPending =
          message.includes('authorization_pending') ||
          message.includes('Authorization is still pending') ||
          message.includes('slow_down');

        if (!isPending) {
          setAuthError(message || 'Authentication failed');
          setAuthState(null);
          return;
        }

        if (attempts >= 30) {
          setAuthError('Authentication timed out after 5 minutes');
          setAuthState(null);
          return;
        }

        setTimeout(() => {
          startPollingForToken(deviceCode, intervalSeconds, attempts + 1);
        }, Math.max(5, intervalSeconds) * 1000);
      }
    },
    [setCopilotToken],
  );

  const handleStartAuth = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await startAuthFlow();
      setAuthState({
        userCode: result.user_code,
        verificationUri: result.verification_uri,
        deviceCode: result.device_code,
        interval: result.interval,
      });
      setUserCode(result.user_code);
      await openUrl(result.verification_uri);
      startPollingForToken(result.device_code, result.interval);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to start authentication');
    } finally {
      setAuthLoading(false);
    }
  }, [startPollingForToken]);

  const handleSaveToken = useCallback(async () => {
    setLocalError(null);
    setSavingCopilot(true);
    try {
      if (!tokenInput.trim()) {
        throw new Error('GitHub token cannot be empty.');
      }
      await setCopilotToken(tokenInput);
      await closeAuthServer();
      setAuthState(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to save Copilot token');
    } finally {
      setSavingCopilot(false);
    }
  }, [setCopilotToken, tokenInput]);

  const handleRemoveCopilot = useCallback(() => {
    clearCopilotToken();
    setTokenInput('');
  }, [clearCopilotToken]);

  const handleRemoveClaude = useCallback(async () => {
    setLocalError(null);
    try {
      await clearClaudeConfig();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to remove Claude configuration');
    }
  }, [clearClaudeConfig]);

  const handleSaveClaudeApiKey = useCallback(async () => {
    setLocalError(null);
    setSavingClaudeApi(true);
    try {
      await configureClaudeApiKey(claudeApiKeyInput);
      setClaudeApiKeyInput('');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to configure Claude API key');
    } finally {
      setSavingClaudeApi(false);
    }
  }, [claudeApiKeyInput, configureClaudeApiKey]);

  const handleSaveClaudePro = useCallback(() => {
    setLocalError(null);
    setSavingClaudePro(true);
    try {
      const resetDayParsed = Number(claudeResetDayInput);
      const resetDay = Number.isFinite(resetDayParsed) ? Math.max(1, Math.min(28, Math.floor(resetDayParsed))) : 1;
      const limit = numberInputToNullable(claudeLimitInput);
      if (limit !== null && limit <= 0) {
        throw new Error('Claude Pro/Max soft limit must be greater than zero.');
      }
      configureClaudePro(claudePlanInput, limit, resetDay);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to configure Claude Pro/Max settings');
    } finally {
      setSavingClaudePro(false);
    }
  }, [claudeLimitInput, claudePlanInput, claudeResetDayInput, configureClaudePro]);

  const hasProviders = providers.some((provider) => provider.enabled);
  const hasCopilot = providers.some((provider) => provider.provider === 'copilot' && provider.enabled);
  const hasClaude = providers.some((provider) => provider.provider === 'claude' && provider.enabled);

  const isAnyLoading = loading.copilot || loading.claude || authLoading || savingCopilot || savingClaudeApi || savingClaudePro;

  return (
    <div className="container">
      <h1>AI Usage Tracker</h1>

      {!hasProviders && <div className="status">No provider configured yet. Add Copilot and/or Claude below.</div>}
      {isAnyLoading && <div className="status">Loading...</div>}
      {(errors.copilot || errors.claude || localError || authError) && (
        <div className="error">
          {errors.copilot ?? errors.claude ?? localError ?? authError}
        </div>
      )}

      {copilotUsage && (
        <>
          <div className="usage-section">
            <ProgressBar
              label="Copilot Premium Requests"
              percent={copilotPercentage}
              used={copilotUsage.premium_requests_used}
              limit={copilotUsage.premium_requests_limit}
            />
          </div>
          <div className="billing-info">
            <p>Copilot billing period end: {new Date(copilotUsage.billing_cycle_end).toLocaleDateString()}</p>
          </div>
        </>
      )}

      {claudeUsage?.mode === 'api' && (
        <>
          <div className="usage-section">
            {typeof claudeUsage.data.requests_limit === 'number' && typeof claudeUsage.data.requests_remaining === 'number' && (
              <ProgressBar
                label="Claude Requests (window)"
                percent={calculatePercentage(
                  Math.max(0, claudeUsage.data.requests_limit - claudeUsage.data.requests_remaining),
                  claudeUsage.data.requests_limit,
                )}
                used={Math.max(0, claudeUsage.data.requests_limit - claudeUsage.data.requests_remaining)}
                limit={claudeUsage.data.requests_limit}
              />
            )}
            {typeof claudeUsage.data.input_tokens_limit === 'number' && (
              <ProgressBar
                label="Claude Input Tokens (window)"
                percent={calculatePercentage(claudeUsage.data.input_tokens_used, claudeUsage.data.input_tokens_limit)}
                used={claudeUsage.data.input_tokens_used}
                limit={claudeUsage.data.input_tokens_limit}
              />
            )}
            {typeof claudeUsage.data.output_tokens_limit === 'number' && (
              <ProgressBar
                label="Claude Output Tokens (window)"
                percent={calculatePercentage(claudeUsage.data.output_tokens_used, claudeUsage.data.output_tokens_limit)}
                used={claudeUsage.data.output_tokens_used}
                limit={claudeUsage.data.output_tokens_limit}
              />
            )}
          </div>
          <div className="billing-info">
            <p>
              Claude API mode shows current rate-limit windows, not monthly billing totals.
              {claudeUsage.data.requests_reset ? ` Requests reset: ${new Date(claudeUsage.data.requests_reset).toLocaleString()}.` : ''}
            </p>
          </div>
        </>
      )}

      {claudeUsage?.mode === 'pro' && (
        <>
          <div className="usage-section">
            {typeof claudeUsage.data.user_defined_limit === 'number' ? (
              <ProgressBar
                label="Claude Pro/Max (App-tracked)"
                percent={calculatePercentage(claudeUsage.data.requests_made, claudeUsage.data.user_defined_limit)}
                used={claudeUsage.data.requests_made}
                limit={claudeUsage.data.user_defined_limit}
              />
            ) : (
              <div className="billing-info">
                <p>Claude Pro/Max does not expose programmatic quota. This app can track only app-recorded requests.</p>
              </div>
            )}
          </div>
          <div className="actions">
            <button onClick={trackClaudeProRequest} className="btn-secondary">Track Claude Pro Request</button>
          </div>
        </>
      )}

      <div className="display-options">
        <label><input type="checkbox" checked={showBar} onChange={(e) => setShowBar(e.target.checked)} /> Show bar</label>
        <label><input type="checkbox" checked={showPercent} onChange={(e) => setShowPercent(e.target.checked)} /> Show percent</label>
        <label>
          Auto-refresh:{' '}
          <select value={refreshInterval} onChange={(e) => setRefreshInterval(Number(e.target.value))}>
            {REFRESH_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>{minutes === 1 ? '1 min' : `${minutes} mins`}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="provider-section">
        <h2>GitHub Copilot</h2>
        <button
          onClick={handleStartAuth}
          disabled={authLoading || authState !== null}
          className="btn-github"
        >
          {authLoading ? 'Starting...' : '🔑 Login with GitHub'}
        </button>

        {authState && (
          <div className="auth-code-section">
            <p>
              Enter this code at{' '}
              <a href={authState.verificationUri} target="_blank" rel="noopener noreferrer">{authState.verificationUri}</a>:
            </p>
            <div className="user-code">{authState.userCode}</div>
            <p className="auth-status">Waiting for authorization...</p>
          </div>
        )}

        {userCode && !authState && (
          <div className="auth-code-section">
            <p>
              If you have not authorized yet, open{' '}
              <a href="https://github.com/login/device" target="_blank" rel="noopener noreferrer">https://github.com/login/device</a> and enter:
            </p>
            <div className="user-code">{userCode}</div>
          </div>
        )}

        <div className="divider"><span>or enter token manually</span></div>

        <input
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="ghp_..."
          className="token-input"
        />
        <div className="actions">
          <button onClick={() => setTokenInput('')} className="btn-secondary">Clear</button>
          <button onClick={handleSaveToken} className="btn-primary" disabled={savingCopilot}>Save Token</button>
          {hasCopilot && <button onClick={handleRemoveCopilot} className="btn-secondary">Remove Copilot</button>}
        </div>
      </div>

      <div className="provider-section">
        <h2>Claude</h2>
        <p className="provider-copy">API mode uses Anthropic API telemetry. Pro/Max/Team mode is app-tracked only.</p>

        <input
          type="password"
          value={claudeApiKeyInput}
          onChange={(e) => setClaudeApiKeyInput(e.target.value)}
          placeholder="sk-ant-api-..."
          className="token-input"
        />
        <div className="actions">
          <button onClick={handleSaveClaudeApiKey} className="btn-primary" disabled={savingClaudeApi}>Save Claude API Key</button>
        </div>

        <div className="pro-config-grid">
          <label>
            Plan
            <select value={claudePlanInput} onChange={(e) => setClaudePlanInput(e.target.value as 'pro' | 'max' | 'team')}>
              <option value="pro">Pro</option>
              <option value="max">Max</option>
              <option value="team">Team</option>
            </select>
          </label>

          <label>
            Soft limit (optional)
            <input
              type="number"
              min={1}
              value={claudeLimitInput}
              onChange={(e) => setClaudeLimitInput(e.target.value)}
              placeholder="e.g. 100"
              className="token-input"
            />
          </label>

          <label>
            Reset day (1-28)
            <input
              type="number"
              min={1}
              max={28}
              value={claudeResetDayInput}
              onChange={(e) => setClaudeResetDayInput(e.target.value)}
              className="token-input"
            />
          </label>
        </div>

        <div className="actions">
          <button onClick={handleSaveClaudePro} className="btn-secondary" disabled={savingClaudePro}>Save Pro/Max/Team Settings</button>
          {hasClaude && <button onClick={() => { void handleRemoveClaude(); }} className="btn-secondary">Remove Claude</button>}
        </div>

        {claudeConfig?.mode === 'pro' && (
          <div className="billing-info">
            <p>Claude mode: Pro/Max app-tracked</p>
          </div>
        )}
      </div>

      <div className="actions">
        <button onClick={refreshAll} disabled={isAnyLoading} className="btn-primary">Refresh</button>
      </div>
    </div>
  );
}

export default App;
