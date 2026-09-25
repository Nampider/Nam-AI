// Does your Foundry model call tools reliably? Phase 2 of AI_ARCHITECTURE depends on it.
// Run with: pnpm tsx scripts/tool-call-test.ts
import { existsSync } from "node:fs";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent, tool } from "langchain";
import { z } from "zod";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

// Two toy tools. The model has no way to answer correctly without calling them:
// the rate is invented, and the payment needs real arithmetic.
let loanLookups = 0;
let paymentCalcs = 0;

const getLoanTerms = tool(
  async ({ loanId }: { loanId: string }) => {
    loanLookups++;
    return JSON.stringify({ loanId, principal: 250000, annualRatePercent: 6.5, years: 10 });
  },
  {
    name: "get_loan_terms",
    description: "Look up the principal, annual interest rate and term of a loan by its id.",
    schema: z.object({ loanId: z.string().describe("The loan id, e.g. L-100") }),
  },
);

const calculatePayment = tool(
  async ({ principal, annualRatePercent, years }: { principal: number; annualRatePercent: number; years: number }) => {
    paymentCalcs++;
    const r = annualRatePercent / 100 / 12;
    const n = years * 12;
    const payment = (principal * r) / (1 - Math.pow(1 + r, -n));
    return JSON.stringify({ monthlyPayment: Number(payment.toFixed(2)) });
  },
  {
    name: "calculate_payment",
    description: "Calculate the monthly payment for a loan. Always use this instead of doing the arithmetic yourself.",
    schema: z.object({
      principal: z.number(),
      annualRatePercent: z.number(),
      years: z.number(),
    }),
  },
);

const model = new ChatOpenAI({
  model: process.env.FOUNDRY_CHAT_DEPLOYMENT!,
  configuration: { baseURL: process.env.FOUNDRY_BASE_URL!, apiKey: process.env.AZURE_API_KEY! },
});

const agent = createAgent({
  model,
  tools: [getLoanTerms, calculatePayment],
  systemPrompt:
    "You are a careful accounting assistant. Use the tools for any figure you need; never do arithmetic yourself.",
});

type Case = { name: string; prompt: string; check: () => { ok: boolean; detail: string } };

async function run(testCase: Case) {
  loanLookups = 0;
  paymentCalcs = 0;
  const started = Date.now();
  try {
    const result = await agent.invoke({ messages: [{ role: "user", content: testCase.prompt }] });
    const last = result.messages.at(-1);
    const answer = typeof last?.content === "string" ? last.content : JSON.stringify(last?.content ?? "");
    const { ok, detail } = testCase.check();
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${ok ? "PASS" : "FAIL"}  ${testCase.name}  (${seconds}s)`);
    console.log(`      ${detail}`);
    console.log(`      answer: ${answer.replace(/\s+/g, " ").slice(0, 140)}`);
    return ok;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`ERROR ${testCase.name}`);
    console.log(`      ${message.slice(0, 300)}`);
    if (/reasoning_content|reasoning content/i.test(message)) {
      console.log(
        "      This is the known DeepSeek issue: the model wants its reasoning replayed after a tool call,\n" +
          "      and LangChain's ChatOpenAI drops it. Tool calling is not usable this way.",
      );
    } else if (/tool|function/i.test(message) && /not support|unsupported|invalid/i.test(message)) {
      console.log("      The deployment appears not to support tool calling at all.");
    }
    return false;
  }
}

const cases: Case[] = [
  {
    name: "1. one tool: looks up the loan",
    prompt: "What annual interest rate applies to loan L-100?",
    check: () => ({
      ok: loanLookups >= 1,
      detail: `get_loan_terms called ${loanLookups}x (expected at least 1)`,
    }),
  },
  {
    name: "2. two tools: look up, then calculate",
    prompt: "What is the monthly payment on loan L-100? Use the tools.",
    check: () => ({
      ok: loanLookups >= 1 && paymentCalcs >= 1,
      detail: `get_loan_terms ${loanLookups}x, calculate_payment ${paymentCalcs}x (expected at least 1 each; correct answer is 2,839.43)`,
    }),
  },
  {
    name: "3. no tool needed: plain reply",
    prompt: "Say hello in exactly five words. Do not use any tool.",
    check: () => ({
      ok: loanLookups === 0 && paymentCalcs === 0,
      detail: `tools called ${loanLookups + paymentCalcs}x (expected 0)`,
    }),
  },
];

async function main() {
  console.log(`Testing ${process.env.FOUNDRY_CHAT_DEPLOYMENT} at ${process.env.FOUNDRY_BASE_URL}\n`);
  const results: boolean[] = [];
  for (const testCase of cases) {
    results.push(await run(testCase));
    console.log("");
  }

  const passed = results.filter(Boolean).length;
  console.log(`${passed}/${results.length} passed`);
  if (passed === results.length) {
    console.log("This model is usable as `main` for Phase 2.");
  } else {
    console.log(
      "Tool calling is not reliable here. Phase 2 needs a different `main` model:\n" +
        "  - deploy another chat model in Foundry and point FOUNDRY_CHAT_DEPLOYMENT at it, or\n" +
        "  - keep this model for plain chat and use a tool-capable one for the agent.",
    );
    process.exitCode = 1;
  }
}

main();
