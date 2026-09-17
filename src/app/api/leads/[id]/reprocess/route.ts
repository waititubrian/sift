import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { leadService } from "@/services/lead.service";

export async function POST(_request: Request, ctx: RouteContext<"/api/leads/[id]/reprocess">) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const result = await leadService.reprocess(id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Reprocess failed", err);
    return NextResponse.json({ error: "Reprocess failed" }, { status: 500 });
  }
}
