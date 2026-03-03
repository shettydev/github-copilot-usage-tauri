import type { ClaudeProUsage } from '../types';

const STORAGE_KEY = 'claude_pro_usage';

interface StoredProUsage {
  requests_made: number;
  user_defined_limit: number | null;
  plan: 'pro' | 'max' | 'team' | null;
  period_start: string;
  period_end: string;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function clampResetDay(resetDay: number): number {
  if (!Number.isFinite(resetDay)) return 1;
  return Math.max(1, Math.min(28, Math.floor(resetDay)));
}

function getBoundaryDate(year: number, month: number, resetDay: number): Date {
  const day = Math.min(clampResetDay(resetDay), daysInMonth(year, month));
  return new Date(year, month, day, 0, 0, 0, 0);
}

function getPeriodWindow(resetDay: number, now = new Date()): { start: Date; end: Date } {
  const day = clampResetDay(resetDay);
  const monthStart = getBoundaryDate(now.getFullYear(), now.getMonth(), day);

  if (now >= monthStart) {
    return {
      start: monthStart,
      end: getBoundaryDate(now.getFullYear(), now.getMonth() + 1, day),
    };
  }

  return {
    start: getBoundaryDate(now.getFullYear(), now.getMonth() - 1, day),
    end: monthStart,
  };
}

function toUsage(record: StoredProUsage): ClaudeProUsage {
  return {
    requests_made: record.requests_made,
    user_defined_limit: record.user_defined_limit,
    plan: record.plan,
    period_start: record.period_start,
    period_end: record.period_end,
  };
}

function defaultRecord(resetDay: number, plan: ClaudeProUsage['plan'], userLimit: number | null): StoredProUsage {
  const period = getPeriodWindow(resetDay);
  return {
    requests_made: 0,
    user_defined_limit: userLimit,
    plan,
    period_start: period.start.toISOString(),
    period_end: period.end.toISOString(),
  };
}

function parseRecord(raw: string | null): StoredProUsage | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredProUsage>;
    if (!parsed || typeof parsed !== 'object') return null;

    const requests = typeof parsed.requests_made === 'number' && parsed.requests_made >= 0 ? Math.floor(parsed.requests_made) : 0;
    const limit = typeof parsed.user_defined_limit === 'number' ? parsed.user_defined_limit : null;
    const plan = parsed.plan === 'pro' || parsed.plan === 'max' || parsed.plan === 'team' ? parsed.plan : null;
    const start = typeof parsed.period_start === 'string' ? parsed.period_start : '';
    const end = typeof parsed.period_end === 'string' ? parsed.period_end : '';

    if (!start || !end) return null;

    return {
      requests_made: requests,
      user_defined_limit: limit,
      plan,
      period_start: start,
      period_end: end,
    };
  } catch {
    return null;
  }
}

function persist(record: StoredProUsage): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export function getProUsage(resetDay: number, plan: ClaudeProUsage['plan'], userLimit: number | null): ClaudeProUsage {
  const period = getPeriodWindow(resetDay);
  const record = parseRecord(localStorage.getItem(STORAGE_KEY));

  if (!record) {
    const initial = defaultRecord(resetDay, plan, userLimit);
    persist(initial);
    return toUsage(initial);
  }

  const periodStart = new Date(record.period_start);
  const periodEnd = new Date(record.period_end);
  const isSamePeriod = periodStart.getTime() === period.start.getTime() && periodEnd.getTime() === period.end.getTime();

  const next: StoredProUsage = {
    requests_made: isSamePeriod ? record.requests_made : 0,
    user_defined_limit: userLimit,
    plan,
    period_start: period.start.toISOString(),
    period_end: period.end.toISOString(),
  };

  persist(next);
  return toUsage(next);
}

export function incrementProUsage(resetDay: number, plan: ClaudeProUsage['plan'], userLimit: number | null): ClaudeProUsage {
  const current = getProUsage(resetDay, plan, userLimit);
  const next: StoredProUsage = {
    ...current,
    requests_made: current.requests_made + 1,
  };
  persist(next);
  return toUsage(next);
}

export function resetProUsage(resetDay: number, plan: ClaudeProUsage['plan'], userLimit: number | null): ClaudeProUsage {
  const initial = defaultRecord(resetDay, plan, userLimit);
  persist(initial);
  return toUsage(initial);
}
