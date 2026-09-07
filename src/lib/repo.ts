import { randomUUID } from "crypto";
import { db } from "./db";
import { ParsedLead, ScoringResult, IntegrationAttempt, Temperature } from "./types";

export interface LeadRow {
  id: string;
  source: string;
  name: string;
  email: string;
  company: string | null;
  raw_message: string;
  raw_payload: string;
  created_at: string;
}

export interface AnalysisRow {
  id: string;
  lead_id: string;
  intent_score: number;
  temperature: Temperature;
  summary: string;
  budget_mentioned: number;
  timeline: string | null;
  pain_point: string;
  recommended_action: string;
  model_used: string;
  created_at: string;
}

export interface IntegrationLogRow {
  id: string;
  lead_id: string;
  target: string;
  status: string;
  response_snippet: string;
  attempted_at: string;
}

export function insertLead(parsed: ParsedLead): LeadRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO lead (id, source, name, email, company, raw_message, raw_payload) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, parsed.source, parsed.name, parsed.email, parsed.company, parsed.rawMessage, JSON.stringify(parsed.rawPayload));
  return db.prepare(`SELECT * FROM lead WHERE id = ?`).get(id) as LeadRow;
}

export function getLead(id: string): LeadRow | undefined {
  return db.prepare(`SELECT * FROM lead WHERE id = ?`).get(id) as LeadRow | undefined;
}

export function insertAnalysis(leadId: string, analysis: ScoringResult): AnalysisRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO ai_analysis (id, lead_id, intent_score, temperature, summary, budget_mentioned, timeline, pain_point, recommended_action, model_used)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    leadId,
    analysis.intent_score,
    analysis.temperature,
    analysis.summary,
    analysis.budget_mentioned ? 1 : 0,
    analysis.timeline,
    analysis.pain_point,
    analysis.recommended_action,
    analysis.model_used
  );
  return db.prepare(`SELECT * FROM ai_analysis WHERE id = ?`).get(id) as AnalysisRow;
}

export function upsertAnalysis(leadId: string, analysis: ScoringResult): AnalysisRow {
  const existing = db.prepare(`SELECT id FROM ai_analysis WHERE lead_id = ?`).get(leadId) as { id: string } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE ai_analysis SET intent_score=?, temperature=?, summary=?, budget_mentioned=?, timeline=?, pain_point=?, recommended_action=?, model_used=?
       WHERE lead_id = ?`
    ).run(
      analysis.intent_score,
      analysis.temperature,
      analysis.summary,
      analysis.budget_mentioned ? 1 : 0,
      analysis.timeline,
      analysis.pain_point,
      analysis.recommended_action,
      analysis.model_used,
      leadId
    );
    return db.prepare(`SELECT * FROM ai_analysis WHERE lead_id = ?`).get(leadId) as AnalysisRow;
  }
  return insertAnalysis(leadId, analysis);
}

export function insertIntegrationLogs(leadId: string, attempts: IntegrationAttempt[]): IntegrationLogRow[] {
  const stmt = db.prepare(
    `INSERT INTO integration_log (id, lead_id, target, status, response_snippet) VALUES (?, ?, ?, ?, ?)`
  );
  const insertMany = db.transaction((items: IntegrationAttempt[]) => {
    for (const a of items) {
      const id = randomUUID();
      stmt.run(id, leadId, a.target, a.status, a.responseSnippet);
    }
  });
  insertMany(attempts);
  return getIntegrationLogs(leadId);
}

export function getIntegrationLogs(leadId: string): IntegrationLogRow[] {
  return db
    .prepare(`SELECT * FROM integration_log WHERE lead_id = ? ORDER BY attempted_at ASC`)
    .all(leadId) as IntegrationLogRow[];
}

export interface LeadWithAnalysis extends LeadRow {
  analysis: AnalysisRow | null;
  logs: IntegrationLogRow[];
}

export function listLeads(temperature?: Temperature | null): LeadWithAnalysis[] {
  const leads = (
    temperature
      ? db
          .prepare(
            `SELECT lead.* FROM lead JOIN ai_analysis ON ai_analysis.lead_id = lead.id
             WHERE ai_analysis.temperature = ? ORDER BY lead.created_at DESC`
          )
          .all(temperature)
      : db.prepare(`SELECT * FROM lead ORDER BY created_at DESC`).all()
  ) as LeadRow[];

  return leads.map((lead) => ({
    ...lead,
    analysis: (db.prepare(`SELECT * FROM ai_analysis WHERE lead_id = ?`).get(lead.id) as AnalysisRow) ?? null,
    logs: getIntegrationLogs(lead.id),
  }));
}
