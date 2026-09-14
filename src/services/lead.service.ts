import { scoreWithAI } from "@/lib/scoring";
import { upsertCRM } from "@/lib/crm";
import { notifyTeam } from "@/lib/notify";
import { leadRepository, qualificationRepository, routingLogRepository } from "@/repositories";
import { ParsedLead, LeadStatus, Temperature } from "@/lib/types";

/**
 * Business logic for leads: routes call these methods, never a repository or
 * Prisma directly. Repositories only ever talk to Prisma; adapters
 * (scoring/crm/notify) only ever talk to their external service.
 */
export const leadService = {
  /** parseLead -> scoreWithAI -> upsertCRM -> notifyTeam -> logResult */
  async create(parsed: ParsedLead) {
    const lead = await leadRepository.create(parsed);

    const analysis = await scoreWithAI(parsed);
    const qualification = await qualificationRepository.create(lead.id, analysis);

    const crmAttempt = await upsertCRM({ ...parsed, id: lead.id }, analysis);
    const notifyAttempts = await notifyTeam(parsed, analysis);
    const logs = await routingLogRepository.createMany(lead.id, [crmAttempt, ...notifyAttempts]);

    const routed = notifyAttempts.some((a) => a.status === "SUCCESS");
    const status: LeadStatus = analysis.temperature === "COLD" ? "DISQUALIFIED" : routed ? "ROUTED" : "QUALIFIED";
    const updatedLead = await leadRepository.updateStatus(lead.id, status);

    return { lead: updatedLead, qualification, logs };
  },

  /** Re-runs AI scoring on an existing lead. Never re-notifies. */
  async reprocess(id: string) {
    const lead = await leadRepository.findById(id);
    if (!lead) throw new Error(`Lead ${id} not found`);

    const parsed: ParsedLead = {
      source: lead.source,
      name: lead.name,
      email: lead.email,
      company: lead.company,
      rawMessage: lead.rawMessage,
      rawPayload: lead.rawPayload as Record<string, unknown>,
    };

    const analysis = await scoreWithAI(parsed);
    const qualification = await qualificationRepository.upsert(lead.id, analysis);

    const logs = await routingLogRepository.createMany(lead.id, [
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
    const updatedLead = await leadRepository.updateStatus(lead.id, status);

    return { lead: updatedLead, qualification, logs };
  },

  list(temperature?: Temperature | null) {
    return leadRepository.findMany(temperature);
  },
};
