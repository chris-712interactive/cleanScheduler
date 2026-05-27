export interface ReportRunParams {
  from: string;
  to: string;
}

export function buildReportRunParams(fromInput: string, toInput: string): ReportRunParams {
  return { from: fromInput, to: toInput };
}

export function reportRunParamsKey(params: ReportRunParams): string {
  return JSON.stringify(params);
}

export const REPORT_RUN_TTL_MS = 60 * 60 * 1000;

export function reportRunExpiresAt(fromMs = Date.now()): string {
  return new Date(fromMs + REPORT_RUN_TTL_MS).toISOString();
}
