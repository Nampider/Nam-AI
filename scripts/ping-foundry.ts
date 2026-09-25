// Smoke test: can this machine reach your Foundry deployment through LangChain?
// Run with: pnpm tsx scripts/ping-foundry.ts
import { existsSync } from "node:fs";
import { ChatOpenAI } from "@langchain/openai";

// Load settings the same way Next.js does: .env.local wins over .env (existing values are never overwritten).
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

async function main() {
  const { FOUNDRY_BASE_URL, FOUNDRY_CHAT_DEPLOYMENT, AZURE_API_KEY } = process.env;
  const missing = Object.entries({ FOUNDRY_BASE_URL, FOUNDRY_CHAT_DEPLOYMENT, AZURE_API_KEY })
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) throw new Error(`Missing in .env: ${missing.join(", ")}`);
  if (!FOUNDRY_BASE_URL!.endsWith("/openai/v1")) {
    throw new Error(`FOUNDRY_BASE_URL must end with /openai/v1 (got ${FOUNDRY_BASE_URL})`);
  }

  const model = new ChatOpenAI({
    model: FOUNDRY_CHAT_DEPLOYMENT,
    configuration: { baseURL: FOUNDRY_BASE_URL, apiKey: AZURE_API_KEY },
  });

  console.log(`Calling ${FOUNDRY_CHAT_DEPLOYMENT} at ${FOUNDRY_BASE_URL} ...`);
  const started = Date.now();
  const reply = await model.invoke("Say hello to Nam-AI in five words.");
  console.log(`Foundry says (${((Date.now() - started) / 1000).toFixed(1)}s):`, reply.content);
}

main().catch((err) => {
  console.error("Foundry call failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
