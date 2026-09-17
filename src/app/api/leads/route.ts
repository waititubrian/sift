import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { leadService } from "@/services/lead.service";
import { Temperature } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const temperature = request.nextUrl.searchParams.get("temperature") as Temperature | null;
  const leads = await leadService.list(temperature);
  return NextResponse.json({ leads });
}
