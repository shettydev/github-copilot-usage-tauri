import { invoke } from "@tauri-apps/api/core";
import type { CopilotUsage } from "../types";

function toNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toIsoString(value: any): string {
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? "" : d.toISOString();
  } catch {
    return "";
  }
}

export async function fetchCopilotUsage(token: string): Promise<CopilotUsage> {
  const response = await invoke<string>("fetch_copilot_usage", { token });
  const parsed = JSON.parse(response);

  const quotaSnapshots =
    parsed?.userInfo?.quota_snapshots ??
    parsed?.quota_snapshots ??
    parsed?.user_info?.quota_snapshots ??
    null;

  const premium = quotaSnapshots?.premium_interactions ?? null;
  const standard = quotaSnapshots?.completions ?? null;

  const premium_entitlement = premium
    ? toNumber(
        premium.entitlement ?? premium.remaining ?? premium.quota_remaining ?? 0
      )
    : 0;
  const premium_remaining = premium
    ? toNumber(premium.remaining ?? premium.quota_remaining ?? 0)
    : 0;

  const standard_entitlement = standard
    ? toNumber(
        standard.entitlement ??
          standard.remaining ??
          standard.quota_remaining ??
          0
      )
    : 0;
  const standard_remaining = standard
    ? toNumber(standard.remaining ?? standard.quota_remaining ?? 0)
    : 0;

  const premium_used = Math.max(0, premium_entitlement - premium_remaining);
  const standard_used = Math.max(0, standard_entitlement - standard_remaining);

  const billing_cycle_start =
    parsed?.billing_cycle_start ?? parsed?.userInfo?.billing_cycle_start ?? "";
  const billing_cycle_end =
    parsed?.quota_reset_date ??
    parsed?.userInfo?.quota_reset_date ??
    parsed?.quota_reset_date_utc ??
    "";

  return {
    premium_requests_used: premium_used,
    premium_requests_limit: premium_entitlement,
    standard_requests_used: standard_used,
    standard_requests_limit: standard_entitlement,
    billing_cycle_start: toIsoString(billing_cycle_start),
    billing_cycle_end: toIsoString(billing_cycle_end),
  };
}

export function calculatePercentage(used: number, limit: number): number {
  if (!limit || limit === 0) return 0;
  return Math.round((used / limit) * 100);
}

export function getStoredToken(): string | null {
  return localStorage.getItem("github_token");
}

export function storeToken(token: string): void {
  localStorage.setItem("github_token", token);
}
