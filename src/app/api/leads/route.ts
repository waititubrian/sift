import { NextRequest, NextResponse } from "next/server";
import { listLeads } from "@/lib/repo";
import { Temperature } from "@/lib/types";

export async function GET(request: NextRequest) {
  const temperature = request.nextUrl.searchParams.get("temperature") as Temperature | null;
  const leads = listLeads(temperature);
  return NextResponse.json({ leads });
}
