import { Resend } from "resend";
import { ParsedLead, ScoringResult, IntegrationAttempt } from "./types";

function buildSlackMessage(lead: ParsedLead, analysis: ScoringResult): string {
  const emoji = analysis.temperature === "hot" ? "🔥" : analysis.temperature === "warm" ? "☀️" : "❄️";
  const who = lead.company ? `${lead.company}` : lead.name;
  const bits = [analysis.budget_mentioned ? "budget mentioned" : null, analysis.timeline ? `${analysis.timeline} timeline` : null].filter(
    Boolean
  );
  const detail = bits.length ? ` — ${bits.join(", ")}` : "";
  const cta = analysis.temperature === "hot" ? " Respond now." : "";
  return `${emoji} ${capitalize(analysis.temperature)} lead: ${who}${detail}.${cta}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function postToSlack(text: string): Promise<IntegrationAttempt> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return {
      target: "slack",
      status: "skipped",
      responseSnippet: text,
    };
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      return { target: "slack", status: "failed", responseSnippet: `HTTP ${res.status}` };
    }
    return { target: "slack", status: "success", responseSnippet: text };
  } catch (err) {
    return {
      target: "slack",
      status: "failed",
      responseSnippet: err instanceof Error ? err.message : "Unknown Slack error",
    };
  }
}

async function sendFallbackEmail(lead: ParsedLead, analysis: ScoringResult): Promise<IntegrationAttempt> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_EMAIL_FROM;
  const to = process.env.NOTIFY_EMAIL_TO;
  if (!apiKey || !from || !to) {
    return {
      target: "email",
      status: "skipped",
      responseSnippet: "Resend not configured; no fallback sent.",
    };
  }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      subject: `[Sift] ${capitalize(analysis.temperature)} lead: ${lead.company ?? lead.name}`,
      text: `${analysis.summary}\n\nScore: ${analysis.intent_score}\nTimeline: ${analysis.timeline ?? "n/a"}\nRecommended action: ${analysis.recommended_action}`,
    });
    if (error) {
      return { target: "email", status: "failed", responseSnippet: error.message };
    }
    return { target: "email", status: "success", responseSnippet: `Email sent to ${to}` };
  } catch (err) {
    return {
      target: "email",
      status: "failed",
      responseSnippet: err instanceof Error ? err.message : "Unknown Resend error",
    };
  }
}

/** Slack is primary; email is only attempted if the Slack post actually fails. */
export async function notifyTeam(lead: ParsedLead, analysis: ScoringResult): Promise<IntegrationAttempt[]> {
  if (analysis.temperature === "cold") {
    return [
      {
        target: "slack",
        status: "skipped",
        responseSnippet: "Cold lead — logged only, no notification sent.",
      },
    ];
  }

  const message = buildSlackMessage(lead, analysis);
  const slackAttempt = await postToSlack(message);
  if (slackAttempt.status !== "failed") {
    return [slackAttempt];
  }

  const emailAttempt = await sendFallbackEmail(lead, analysis);
  return [slackAttempt, emailAttempt];
}
