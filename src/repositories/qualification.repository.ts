import { prisma } from "@/lib/db";
import { ScoringResult } from "@/lib/types";

function toData(analysis: ScoringResult) {
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

/** Pure Prisma access for the Qualification model. */
export const qualificationRepository = {
  create(leadId: string, analysis: ScoringResult) {
    return prisma.qualification.create({ data: { leadId, ...toData(analysis) } });
  },

  upsert(leadId: string, analysis: ScoringResult) {
    const data = toData(analysis);
    return prisma.qualification.upsert({
      where: { leadId },
      create: { leadId, ...data },
      update: data,
    });
  },
};
