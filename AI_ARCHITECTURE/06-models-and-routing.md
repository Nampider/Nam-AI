# 06 — Models, routing, and evaluation

[← Back to README](./README.md)

## Do we need multiple models?

Yes, but mostly **different kinds of models for different jobs**, not several "brains" arguing with each other.

| Role | What it does | Kind of model | Current / candidate (Microsoft Foundry) | Phase |
|---|---|---|---|---|
| `main` | Orchestrator: reasoning, tool calling, final answers | Large reasoning model with reliable tool calling | DeepSeek-V4-Pro (deployed now) | now |
| `fast` | Chat titles, query rewriting for search, summarizing old turns, simple classification | Small, cheap, fast chat model | any "mini"-class model in the Foundry catalog | 2–3 |
| `embed` | Turns text into embeddings for RAG | Embedding model | `text-embedding-3-large` (with `dimensions: 1536`) or Cohere Embed | 3 |
| `rerank` | Re-scores search results for relevance | Reranker | a Cohere Rerank model in the Foundry catalog | 3 |
| `fallback` | Used when `main` errors or is throttled | Another large model deployment | TBD | 4 |
| subagents | Phase 5 subagents | Default = `main`; cheaper model where evals show it's good enough | | 5 |

**Check before Phase 2:** confirm the DeepSeek-V4-Pro deployment supports tool/function calling reliably through the Foundry OpenAI-compatible endpoint (run a few multi-tool test prompts). If it's weak at tool calling, choose a different `main` model; tool calling is the backbone of this design.

## One place for model config

Every part of the app asks for a model **by role** (`models.main`, `models.fast`…), never by deployment name. Swapping a model is then a one-line/env change.

```ts
// lib/ai/models.ts — illustrative
import "server-only";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

const configuration = { baseURL: process.env.FOUNDRY_BASE_URL!, apiKey: credential /* as in langchain.ts */ };

export const models = {
  main: new ChatOpenAI({ model: process.env.FOUNDRY_CHAT_DEPLOYMENT!, configuration }),
  fast: new ChatOpenAI({ model: process.env.FOUNDRY_FAST_DEPLOYMENT!, configuration, temperature: 0 }),
  embed: new OpenAIEmbeddings({ model: process.env.FOUNDRY_EMBED_DEPLOYMENT!, dimensions: 1536, configuration }),
};
```

Env vars to add as phases arrive: `FOUNDRY_FAST_DEPLOYMENT`, `FOUNDRY_EMBED_DEPLOYMENT`, `FOUNDRY_RERANK_DEPLOYMENT`, `FOUNDRY_FALLBACK_DEPLOYMENT`.

## Do we need a router in front of the agent?

A **router** is a quick, cheap classification step before the main agent ("is this chit-chat, tax research, a client question, a spreadsheet request, or out of scope?").

- **Not at first.** With tools, the main agent already decides what to do; a router would duplicate that decision.
- **Add one when** cost or latency matters: e.g. send "thanks!" or "make this shorter" to the `fast` model with no tools, or preload only the relevant tool subset. `langchain` also has `llmToolSelectorMiddleware` for trimming the tool list when there are many tools.

## Settings

- `temperature`: low (0–0.3) for `main` in tax answers; 0 for `fast` extraction tasks.
- Timeouts and retries per call; `modelFallbackMiddleware` for the fallback model.
- Record token usage per run (`agent_runs`) to see cost per user and per question type.

## Evaluation ("evals")

An eval is an automated quality test. Without it, every prompt or model change is a guess.

**Build a golden set** (start with 50–100 questions, reviewed by an accountant), each with:

- the question (and client fixture, if client-specific),
- the expected key facts/numbers,
- the source(s) that should be cited,
- the tax year and jurisdiction.

**Score:**

| Metric | Question it answers |
|---|---|
| Retrieval recall | Did the right section appear in the top results? |
| Citation accuracy | Is every claim backed by a cited source that actually says it? |
| Numeric accuracy | Are the numbers exactly right? |
| Abstention | When the answer isn't in the knowledge base, does it say so instead of guessing? |
| Tool behaviour | Did it call `calculate` instead of doing mental math? Did it stay within call limits? |
| Cost / latency | Tokens and seconds per answer |

Run evals on every change to prompts, models, chunking, or retrieval settings (a script in `evals/`; LangSmith is an option for tracing and eval dashboards). Add every real bad answer users report to the golden set.
