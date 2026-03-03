import { invoke } from '@tauri-apps/api/core';
import type { ClaudeApiUsage, ClaudeProUsage } from '../types';
import { getProUsage, incrementProUsage, resetProUsage } from './localUsageTracker';

interface ClaudeRateLimitSnapshot {
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

function normalizeTimestamp(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function validateAnthropicKey(apiKey: string): Promise<boolean> {
  if (!apiKey.trim()) return false;
  return invoke<boolean>('validate_anthropic_key', { apiKey });
}

export async function fetchClaudeApiUsage(apiKey: string): Promise<ClaudeApiUsage> {
  const snapshot = await invoke<ClaudeRateLimitSnapshot>('fetch_claude_rate_limits', { apiKey });

  return {
    input_tokens_used: snapshot.input_tokens_used,
    output_tokens_used: snapshot.output_tokens_used,
    cache_creation_tokens_used: snapshot.cache_creation_tokens_used,
    cache_read_tokens_used: snapshot.cache_read_tokens_used,
    requests_limit: snapshot.requests_limit,
    requests_remaining: snapshot.requests_remaining,
    requests_reset: normalizeTimestamp(snapshot.requests_reset),
    input_tokens_limit: snapshot.input_tokens_limit,
    input_tokens_remaining: snapshot.input_tokens_remaining,
    input_tokens_reset: normalizeTimestamp(snapshot.input_tokens_reset),
    output_tokens_limit: snapshot.output_tokens_limit,
    output_tokens_remaining: snapshot.output_tokens_remaining,
    output_tokens_reset: normalizeTimestamp(snapshot.output_tokens_reset),
  };
}

export function readClaudeProUsage(resetDay: number, plan: ClaudeProUsage['plan'], userLimit: number | null): ClaudeProUsage {
  return getProUsage(resetDay, plan, userLimit);
}

export function incrementClaudeProUsage(resetDay: number, plan: ClaudeProUsage['plan'], userLimit: number | null): ClaudeProUsage {
  return incrementProUsage(resetDay, plan, userLimit);
}

export function resetClaudeProUsage(resetDay: number, plan: ClaudeProUsage['plan'], userLimit: number | null): ClaudeProUsage {
  return resetProUsage(resetDay, plan, userLimit);
}
