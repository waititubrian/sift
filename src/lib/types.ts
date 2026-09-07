export type Temperature = "COLD" | "WARM" | "HOT";

export type LeadStatus = "NEW" | "QUALIFIED" | "DISQUALIFIED" | "ROUTED";

export type IntegrationTarget = "CRM" | "SLACK" | "EMAIL";

export type IntegrationStatus = "SUCCESS" | "FAILED" | "SKIPPED";

export interface ParsedLead {
  source: string;
  name: string;
  email: string;
  company: string | null;
  rawMessage: string;
  rawPayload: Record<string, unknown>;
}

export interface ScoringResult {
  intent_score: number;
  temperature: Temperature;
  reasoning: string;
  budget_mentioned: boolean;
  timeline: string | null;
  pain_point: string;
  recommended_action: string;
  model_used: string;
}

export interface IntegrationAttempt {
  target: IntegrationTarget;
  status: IntegrationStatus;
  detail: string;
}

export function temperatureFromScore(score: number): Temperature {
  if (score >= 70) return "HOT";
  if (score >= 40) return "WARM";
  return "COLD";
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
