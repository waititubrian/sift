import { Resend } from "resend";
import { ParsedLead, ScoringResult, IntegrationAttempt, titleCase } from "./types";

function buildSlackMessage(lead: ParsedLead, analysis: ScoringResult): string {
  const emoji = analysis.temperature === "HOT" ? "🔥" : analysis.temperature === "WARM" ? "☀️" : "❄️";
  const who = lead.company ? `${lead.company}` : lead.name;
  const bits = [analysis.budget_mentioned ? "budget mentioned" : null, analysis.timeline ? `${analysis.timeline} timeline` : null].filter(
    Boolean
  );
  const detail = bits.length ? ` — ${bits.join(", ")}` : "";
  const cta = analysis.temperature === "HOT" ? " Respond now." : "";
  return `${emoji} ${titleCase(analysis.temperature)} lead: ${who}${detail}.${cta}`;
}

async function postToSlack(text: string): Promise<IntegrationAttempt> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return {
      target: "SLACK",
      status: "SKIPPED",
      detail: text,
    };
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      return { target: "SLACK", status: "FAILED", detail: `HTTP ${res.status}` };
    }
    return { target: "SLACK", status: "SUCCESS", detail: text };
  } catch (err) {
    return {
      target: "SLACK",
      status: "FAILED",
      detail: err instanceof Error ? err.message : "Unknown Slack error",
    };
  }
}

async function sendFallbackEmail(lead: ParsedLead, analysis: ScoringResult): Promise<IntegrationAttempt> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_EMAIL_FROM;
  const to = process.env.NOTIFY_EMAIL_TO;
  if (!apiKey || !from || !to) {
    return {
      target: "EMAIL",
      status: "SKIPPED",
      detail: "Resend not configured; no fallback sent.",
    };
  }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      subject: `[Sift] ${titleCase(analysis.temperature)} lead: ${lead.company ?? lead.name}`,
      text: `${analysis.reasoning}\n\nScore: ${analysis.intent_score}\nTimeline: ${analysis.timeline ?? "n/a"}\nRecommended action: ${analysis.recommended_action}`,
    });
    if (error) {
      return { target: "EMAIL", status: "FAILED", detail: error.message };
    }
    return { target: "EMAIL", status: "SUCCESS", detail: `Email sent to ${to}` };
  } catch (err) {
    return {
      target: "EMAIL",
      status: "FAILED",
      detail: err instanceof Error ? err.message : "Unknown Resend error",
    };
  }
}

/** Slack is primary; email is only attempted if the Slack post actually fails. */
export async function notifyTeam(lead: ParsedLead, analysis: ScoringResult): Promise<IntegrationAttempt[]> {
  if (analysis.temperature === "COLD") {
    return [
      {
        target: "SLACK",
        status: "SKIPPED",
        detail: "Cold lead — logged only, no notification sent.",
      },
    ];
  }

  const message = buildSlackMessage(lead, analysis);
  const slackAttempt = await postToSlack(message);
  if (slackAttempt.status !== "FAILED") {
    return [slackAttempt];
  }

  const emailAttempt = await sendFallbackEmail(lead, analysis);
  return [slackAttempt, emailAttempt];
}
