import "dotenv/config";
import { runPipeline } from "../src/lib/pipeline";
import type { ParsedLead } from "../src/lib/types";

const SEED_LEADS: Omit<ParsedLead, "source" | "rawPayload">[] = [
  {
    name: "Jordan Reyes",
    email: "jordan@acmeagency.com",
    company: "Acme Co",
    rawMessage:
      "Hi, we're a 40-person agency looking to automate onboarding, budget ~$15k, want to move by Q1.",
  },
  {
    name: "Priya Nair",
    email: "priya@northwind.io",
    company: "Northwind Retail",
    rawMessage:
      "We're a 60-person team and our manual order processing doesn't scale anymore. Budget is around $25k, need something live by next quarter.",
  },
  {
    name: "Marcus Lee",
    email: "marcus@lee-consulting.com",
    company: "Lee Consulting",
    rawMessage:
      "Looking to automate client intake ASAP — we're losing leads because our current process is too slow. Can move immediately.",
  },
  {
    name: "Sam Patel",
    email: "sam@example.com",
    company: null,
    rawMessage: "just curious about pricing",
  },
  {
    name: "Ana Torres",
    email: "ana@torresdesign.co",
    company: "Torres Design",
    rawMessage: "Hey, do you offer a free trial? Just browsing options for now, no rush.",
  },
  {
    name: "Ben Whitfield",
    email: "ben@whitfieldlaw.com",
    company: "Whitfield & Partners",
    rawMessage:
      "We're a 15-person law firm struggling with manual client intake. Not sure of budget yet but want to explore this quarter.",
  },
  {
    name: "Chloe Kim",
    email: "chloe@kimstudio.com",
    company: "Kim Studio",
    rawMessage: "What integrations do you support?",
  },
  {
    name: "David Osei",
    email: "david@oseigroup.com",
    company: "Osei Group",
    rawMessage:
      "We need to replace our current lead routing tool. Team of 100+, budget approved at $40k, want to start this month.",
  },
  {
    name: "Emma Fischer",
    email: "emma@fischerlogistics.com",
    company: "Fischer Logistics",
    rawMessage: "Someday we'd like to look into automation, but nothing urgent right now.",
  },
  {
    name: "Farid Haddad",
    email: "farid@haddadgroup.com",
    company: "Haddad Group",
    rawMessage:
      "Our onboarding is a bottleneck — manual, slow, and error-prone. We have budget set aside and want this solved by next month.",
  },
];

async function main() {
  console.log(`Seeding ${SEED_LEADS.length} demo leads…`);
  for (const lead of SEED_LEADS) {
    const { qualification } = await runPipeline({
      source: "seed",
      rawPayload: { seed: true },
      ...lead,
    });
    console.log(`  ${lead.name.padEnd(16)} score ${qualification.score} (${qualification.temperature})`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
