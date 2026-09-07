import { scoreWithAI } from "./scoring";
import { upsertCRM } from "./crm";
import { notifyTeam } from "./notify";
import { ParsedLead } from "./types";
import { insertLead, insertAnalysis, upsertAnalysis, insertIntegrationLogs, getLead } from "./repo";

/** parseLead -> scoreWithAI -> upsertCRM -> notifyTeam -> logResult */
export async function runPipeline(parsed: ParsedLead) {
  const lead = insertLead(parsed);

  const analysis = await scoreWithAI(parsed);
  const savedAnalysis = insertAnalysis(lead.id, analysis);

  const crmAttempt = await upsertCRM({ ...parsed, id: lead.id }, analysis);
  const notifyAttempts = await notifyTeam(parsed, analysis);

  const logs = insertIntegrationLogs(lead.id, [crmAttempt, ...notifyAttempts]);

  return { lead, analysis: savedAnalysis, logs };
}

export async function reprocessLead(leadId: string) {
  const lead = getLead(leadId);
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const parsed: ParsedLead = {
    source: lead.source,
    name: lead.name,
    email: lead.email,
    company: lead.company,
    rawMessage: lead.raw_message,
    rawPayload: JSON.parse(lead.raw_payload),
  };

  const analysis = await scoreWithAI(parsed);
  const savedAnalysis = upsertAnalysis(lead.id, analysis);

  const logs = insertIntegrationLogs(lead.id, [
    {
      target: "crm",
      status: "success",
      responseSnippet: `Reprocessed: score ${analysis.intent_score} (${analysis.temperature})`,
    },
  ]);

  return { lead, analysis: savedAnalysis, logs };
}
