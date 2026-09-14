import { NextRequest, NextResponse } from "next/server";
import { leadService } from "@/services/lead.service";
import { Temperature } from "@/lib/types";

export async function GET(request: NextRequest) {
  const temperature = request.nextUrl.searchParams.get("temperature") as Temperature | null;
  const leads = await leadService.list(temperature);
  return NextResponse.json({ leads });
}
