import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySignature } from "@/lib/hmac";
import { runPipeline } from "@/lib/pipeline";

const intakeSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  company: z.string().max(200).optional().nullable(),
  message: z.string().min(1).max(4000),
});

export async function POST(request: NextRequest, ctx: RouteContext<"/api/intake/[source]">) {
  const { source } = await ctx.params;

  const rawBody = await request.text();
  const signature = request.headers.get("x-sift-signature");
  if (!verifySignature(source, rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = intakeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, company, message } = parsed.data;

  try {
    const result = await runPipeline({
      source,
      name,
      email,
      company: company ?? null,
      rawMessage: message,
      rawPayload: json as Record<string, unknown>,
    });

    return NextResponse.json(
      {
        lead: result.lead,
        qualification: result.qualification,
        logs: result.logs,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Intake pipeline failed", err);
    return NextResponse.json({ error: "Pipeline failed" }, { status: 500 });
  }
}
