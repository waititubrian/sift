import Anthropic from "@anthropic-ai/sdk";
import { ParsedLead, ScoringResult, temperatureFromScore } from "./types";

const SYSTEM_PROMPT =
  "You are a sales development rep's assistant. Given a raw inbound lead message, " +
  "extract structured signals and score intent from 0-100. Be conservative — a vague " +
  "inquiry is cold, not warm.";

const SCORING_TOOL: Anthropic.Tool = {
  name: "submit_lead_analysis",
  description: "Submit the structured analysis of an inbound lead message.",
  input_schema: {
    type: "object",
    properties: {
      intent_score: { type: "integer", minimum: 0, maximum: 100 },
      temperature: { type: "string", enum: ["cold", "warm", "hot"] },
      summary: { type: "string", description: "One-line summary of the lead." },
      budget_mentioned: { type: "boolean" },
      timeline: { type: ["string", "null"], description: "Timeframe mentioned, if any." },
      pain_point: { type: "string" },
      recommended_action: { type: "string" },
    },
    required: [
      "intent_score",
      "temperature",
      "summary",
      "budget_mentioned",
      "timeline",
      "pain_point",
      "recommended_action",
    ],
  },
};

const MODEL = "claude-sonnet-5";

export async function scoreWithAI(lead: ParsedLead): Promise<ScoringResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return ruleBasedScore(lead);
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      tools: [SCORING_TOOL],
      tool_choice: { type: "tool", name: "submit_lead_analysis" },
      messages: [
        {
          role: "user",
          content: `Name: ${lead.name}\nCompany: ${lead.company ?? "unknown"}\nMessage: ${lead.rawMessage}`,
        },
      ],
    });

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
    if (!toolUse) throw new Error("Model did not return a tool call");

    const input = toolUse.input as Omit<ScoringResult, "model_used">;
    return { ...input, model_used: MODEL };
  } catch (err) {
    console.error("scoreWithAI: falling back to rule-based scorer", err);
    return ruleBasedScore(lead);
  }
}

const VAGUE_PHRASES = [
  "just curious",
  "just browsing",
  "no rush",
  "someday",
  "not sure yet",
  "just wondering",
];

const URGENCY_WORDS = ["asap", "urgent", "immediately", "right away", "this week"];

const TIMELINE_PATTERN =
  /\b(q[1-4]|this (month|quarter|week)|next (month|quarter|week)|jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(tember)?|oct(ober)?|nov(ember)?|dec(ember)?|asap|immediately|by \w+)\b/i;

const BUDGET_PATTERN = /\$\s?\d[\d,.]*\s?(k|m|thousand|million)?|\bbudget\b.{0,20}\d/i;

const PAIN_KEYWORDS = [
  "automat",
  "scale",
  "manual",
  "struggl",
  "problem",
  "bottleneck",
  "slow",
  "inefficient",
  "doesn't scale",
];

export function ruleBasedScore(lead: ParsedLead): ScoringResult {
  const text = lead.rawMessage.toLowerCase();

  const budgetMatch = lead.rawMessage.match(BUDGET_PATTERN);
  const budgetMentioned = !!budgetMatch;

  const timelineMatch = lead.rawMessage.match(TIMELINE_PATTERN);
  const timeline = timelineMatch ? titleCase(timelineMatch[0].replace(/^by\s+/i, "")) : null;

  const hasUrgency = URGENCY_WORDS.some((w) => text.includes(w));
  const isVague = VAGUE_PHRASES.some((p) => text.includes(p));
  const mentionsTeamSize = /\b\d{1,4}[\s-]?(person|people|employee|user)/i.test(lead.rawMessage);

  let score = 20;
  if (budgetMentioned) score += 35;
  if (timeline) score += 25;
  if (hasUrgency) score += 10;
  if (mentionsTeamSize) score += 10;
  if (isVague) score -= 25;
  if (lead.rawMessage.trim().length < 40) score -= 10;
  score = Math.max(0, Math.min(100, score));

  const temperature = temperatureFromScore(score);

  const painSentence =
    lead.rawMessage
      .split(/(?<=[.!?])\s+/)
      .find((sentence) => PAIN_KEYWORDS.some((k) => sentence.toLowerCase().includes(k))) ?? null;

  const recommendedAction =
    temperature === "hot"
      ? "Route to AE, respond same day"
      : temperature === "warm"
        ? "Add to nurture sequence, follow up within a few days"
        : "Log only, no immediate follow-up";

  const summaryParts = [lead.company ?? lead.name];
  if (budgetMentioned) summaryParts.push("budget mentioned");
  if (timeline) summaryParts.push(`timeline ${timeline}`);
  if (isVague) summaryParts.push("low-intent inquiry");
  const summary = summaryParts.join(" — ");

  return {
    intent_score: score,
    temperature,
    summary,
    budget_mentioned: budgetMentioned,
    timeline,
    pain_point: painSentence?.trim() ?? "Not specified",
    recommended_action: recommendedAction,
    model_used: "rule-based-fallback",
  };
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}
