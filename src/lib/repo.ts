import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ParsedLead, ScoringResult, IntegrationAttempt, LeadStatus, Temperature } from "./types";

export function insertLead(parsed: ParsedLead) {
  return prisma.lead.create({
    data: {
      source: parsed.source,
      name: parsed.name,
      email: parsed.email,
      company: parsed.company,
      rawMessage: parsed.rawMessage,
      rawPayload: parsed.rawPayload as Prisma.InputJsonValue,
    },
  });
}

export function getLead(id: string) {
  return prisma.lead.findUnique({ where: { id } });
}

function qualificationData(analysis: ScoringResult) {
  return {
    score: analysis.intent_score,
    temperature: analysis.temperature,
    reasoning: analysis.reasoning,
    budgetMentioned: analysis.budget_mentioned,
    timeline: analysis.timeline,
    painPoint: analysis.pain_point,
    recommendedAction: analysis.recommended_action,
    modelUsed: analysis.model_used,
  };
}

export function insertQualification(leadId: string, analysis: ScoringResult) {
  return prisma.qualification.create({ data: { leadId, ...qualificationData(analysis) } });
}

export function upsertQualification(leadId: string, analysis: ScoringResult) {
  const data = qualificationData(analysis);
  return prisma.qualification.upsert({
    where: { leadId },
    create: { leadId, ...data },
    update: data,
  });
}

export async function insertRoutingLogs(leadId: string, attempts: IntegrationAttempt[]) {
  await prisma.routingLog.createMany({
    data: attempts.map((a) => ({
      leadId,
      target: a.target,
      status: a.status,
      detail: a.detail,
    })),
  });
  return getRoutingLogs(leadId);
}

export function getRoutingLogs(leadId: string) {
  return prisma.routingLog.findMany({ where: { leadId }, orderBy: { attemptedAt: "asc" } });
}

export function updateLeadStatus(leadId: string, status: LeadStatus) {
  return prisma.lead.update({ where: { id: leadId }, data: { status } });
}

export function listLeads(temperature?: Temperature | null) {
  return prisma.lead.findMany({
    where: temperature ? { qualification: { temperature } } : undefined,
    include: { qualification: true, routingLogs: { orderBy: { attemptedAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export type LeadWithDetails = Prisma.PromiseReturnType<typeof listLeads>[number];
