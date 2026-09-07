export type Temperature = "cold" | "warm" | "hot";

export type IntegrationTarget = "crm" | "slack" | "email";

export type IntegrationStatus = "success" | "failed" | "skipped";

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
  summary: string;
  budget_mentioned: boolean;
  timeline: string | null;
  pain_point: string;
  recommended_action: string;
  model_used: string;
}

export interface IntegrationAttempt {
  target: IntegrationTarget;
  status: IntegrationStatus;
  responseSnippet: string;
}

export function temperatureFromScore(score: number): Temperature {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}
