export interface CopilotUsage {
  premium_requests_used: number;
  premium_requests_limit: number;
  standard_requests_used: number;
  standard_requests_limit: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
}

export interface UsagePercentage {
  premium: number;
  standard: number;
}

export type ProviderType = 'copilot' | 'claude';

export interface ClaudeApiUsage {
  input_tokens_used: number;
  output_tokens_used: number;
  cache_creation_tokens_used: number;
  cache_read_tokens_used: number;
  requests_limit: number | null;
  requests_remaining: number | null;
  requests_reset: string | null;
  input_tokens_limit: number | null;
  input_tokens_remaining: number | null;
  input_tokens_reset: string | null;
  output_tokens_limit: number | null;
  output_tokens_remaining: number | null;
  output_tokens_reset: string | null;
}

export interface ClaudeProUsage {
  requests_made: number;
  user_defined_limit: number | null;
  plan: 'pro' | 'max' | 'team' | null;
  period_start: string;
  period_end: string;
}

export type ClaudeUsage =
  | {
      mode: 'api';
      data: ClaudeApiUsage;
    }
  | {
      mode: 'pro';
      data: ClaudeProUsage;
    };

export interface ProviderConfigBase {
  provider: ProviderType;
  enabled: boolean;
  label: string;
}

export interface CopilotProviderConfig extends ProviderConfigBase {
  provider: 'copilot';
  tokenStorageKey: 'github_token';
}

export interface ClaudeProviderConfig extends ProviderConfigBase {
  provider: 'claude';
  mode: 'api' | 'pro';
  apiKeyStored: boolean;
  plan?: 'pro' | 'max' | 'team';
  userDefinedLimit?: number;
  periodResetDay?: number;
}

export type ProviderConfig = CopilotProviderConfig | ClaudeProviderConfig;
