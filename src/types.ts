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
