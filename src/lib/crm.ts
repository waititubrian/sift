import { ParsedLead, ScoringResult, IntegrationAttempt } from "./types";

/**
 * CRM writes go through this interface so the CRM can be swapped (Airtable -> HubSpot,
 * per the spec) without touching scoring or notification logic.
 */
interface CrmAdapter {
  upsert(lead: ParsedLead & { id: string }, analysis: ScoringResult): Promise<IntegrationAttempt>;
}

class AirtableAdapter implements CrmAdapter {
  constructor(
    private apiKey: string,
    private baseId: string,
    private table: string
  ) {}

  async upsert(lead: ParsedLead & { id: string }, analysis: ScoringResult): Promise<IntegrationAttempt> {
    try {
      const res = await fetch(
        `https://api.airtable.com/v0/${this.baseId}/${encodeURIComponent(this.table)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              Name: lead.name,
              Email: lead.email,
              Company: lead.company ?? "",
              Message: lead.rawMessage,
              "Intent Score": analysis.intent_score,
              Temperature: analysis.temperature,
              Reasoning: analysis.reasoning,
            },
          }),
        }
      );
      const body = await res.text();
      if (!res.ok) {
        return { target: "CRM", status: "FAILED", detail: body.slice(0, 200) };
      }
      return { target: "CRM", status: "SUCCESS", detail: `Airtable record created: ${body.slice(0, 120)}` };
    } catch (err) {
      return {
        target: "CRM",
        status: "FAILED",
        detail: err instanceof Error ? err.message : "Unknown Airtable error",
      };
    }
  }
}

class LocalAdapter implements CrmAdapter {
  async upsert(lead: ParsedLead & { id: string }, analysis: ScoringResult): Promise<IntegrationAttempt> {
    return {
      target: "CRM",
      status: "SUCCESS",
      detail: `Stored in Sift as lead ${lead.id} (${analysis.temperature}, score ${analysis.intent_score}). Configure AIRTABLE_API_KEY + AIRTABLE_BASE_ID to write to Airtable instead.`,
    };
  }
}

export function getCrmAdapter(): CrmAdapter {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || "Leads";
  if (apiKey && baseId) {
    return new AirtableAdapter(apiKey, baseId, table);
  }
  return new LocalAdapter();
}

export async function upsertCRM(
  lead: ParsedLead & { id: string },
  analysis: ScoringResult
): Promise<IntegrationAttempt> {
  return getCrmAdapter().upsert(lead, analysis);
}
