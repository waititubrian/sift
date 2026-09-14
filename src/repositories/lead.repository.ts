import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ParsedLead, LeadStatus, Temperature } from "@/lib/types";

/** Pure Prisma access for the Lead model — no business logic, no orchestration. */
export const leadRepository = {
  create(parsed: ParsedLead) {
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
  },

  findById(id: string) {
    return prisma.lead.findUnique({ where: { id } });
  },

  findMany(temperature?: Temperature | null) {
    return prisma.lead.findMany({
      where: temperature ? { qualification: { temperature } } : undefined,
      include: { qualification: true, routingLogs: { orderBy: { attemptedAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  },

  updateStatus(id: string, status: LeadStatus) {
    return prisma.lead.update({ where: { id }, data: { status } });
  },
};

export type LeadWithDetails = Prisma.PromiseReturnType<typeof leadRepository.findMany>[number];
