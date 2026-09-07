import { scoreWithAI } from "./scoring";
import { upsertCRM } from "./crm";
import { notifyTeam } from "./notify";
import { ParsedLead, LeadStatus } from "./types";
import {
  insertLead,
  insertQualification,
  upsertQualification,
  insertRoutingLogs,
  getLead,
  updateLeadStatus,
} from "./repo";

/** parseLead -> scoreWithAI -> upsertCRM -> notifyTeam -> logResult */
export async function runPipeline(parsed: ParsedLead) {
  const lead = await insertLead(parsed);

  const analysis = await scoreWithAI(parsed);
  const qualification = await insertQualification(lead.id, analysis);

  const crmAttempt = await upsertCRM({ ...parsed, id: lead.id }, analysis);
  const notifyAttempts = await notifyTeam(parsed, analysis);
  const logs = await insertRoutingLogs(lead.id, [crmAttempt, ...notifyAttempts]);

  const routed = notifyAttempts.some((a) => a.status === "SUCCESS");
  const status: LeadStatus = analysis.temperature === "COLD" ? "DISQUALIFIED" : routed ? "ROUTED" : "QUALIFIED";
  const updatedLead = await updateLeadStatus(lead.id, status);

  return { lead: updatedLead, qualification, logs };
}

export async function reprocessLead(leadId: string) {
  const lead = await getLead(leadId);
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const parsed: ParsedLead = {
    source: lead.source,
    name: lead.name,
    email: lead.email,
    company: lead.company,
    rawMessage: lead.rawMessage,
    rawPayload: lead.rawPayload as Record<string, unknown>,
  };

  const analysis = await scoreWithAI(parsed);
  const qualification = await upsertQualification(lead.id, analysis);

  const logs = await insertRoutingLogs(lead.id, [
    {
      target: "CRM",
      status: "SUCCESS",
      detail: `Reprocessed: score ${analysis.intent_score} (${analysis.temperature})`,
    },
  ]);

  // Reprocessing only re-scores; it doesn't re-notify, so a lead already
  // routed stays routed unless the new score disqualifies it outright.
  const status: LeadStatus =
    analysis.temperature === "COLD" ? "DISQUALIFIED" : lead.status === "ROUTED" ? "ROUTED" : "QUALIFIED";
  const updatedLead = await updateLeadStatus(lead.id, status);

  return { lead: updatedLead, qualification, logs };
}
