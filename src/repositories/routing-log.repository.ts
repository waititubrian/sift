import { prisma } from "@/lib/db";
import { IntegrationAttempt } from "@/lib/types";

/** Pure Prisma access for the RoutingLog model. */
export const routingLogRepository = {
  async createMany(leadId: string, attempts: IntegrationAttempt[]) {
    await prisma.routingLog.createMany({
      data: attempts.map((a) => ({
        leadId,
        target: a.target,
        status: a.status,
        detail: a.detail,
      })),
    });
    return routingLogRepository.findByLeadId(leadId);
  },

  findByLeadId(leadId: string) {
    return prisma.routingLog.findMany({ where: { leadId }, orderBy: { attemptedAt: "asc" } });
  },
};
