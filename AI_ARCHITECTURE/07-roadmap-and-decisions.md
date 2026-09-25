# 07 — Roadmap, decision log, and open questions

[← Back to README](./README.md)

## Build order

Each phase ships something usable and sets up the next.

| Phase | Goal | Main work | Done when |
|---|---|---|---|
| **0** ✅ | Plain chat | `ChatOpenAI` → Foundry, streaming UI | Chat works end-to-end |
| **1** | Persistence (from the original blueprint) | Postgres `conversations` / `messages` tables, server-side history, replace `lib/chat-store.ts` | Chats survive reloads and devices |
| **2** | Tool-using agent + Excel | `lib/ai/models.ts`, `lib/ai/agent.ts` with `createAgent`, `calculate`, `create_spreadsheet` + ExcelJS, `generated_files` + download route, tool-status chips and file cards in UI, audit tables | "Build me an amortization schedule for a $250k loan at 6.5% over 10 years" returns a correct .xlsx |
| **3** | RAG v1 (tax authority) | pgvector, ingestion script for a starter corpus (e.g. current-year IRS publications + selected IRC sections), `search_tax_authority`, `lookup_citation`, source cards, first golden-set evals | Tax questions answered with correct citations; evals passing agreed thresholds |
| **4** | Client data | `clients`, `client_access`, financials/fixed-asset import, client uploads → `client_documents`, client tools, PII masking, selected-client picker in UI | Client-specific questions and workbooks, with permission tests |
| **5** | Deep agent | `deepagents` `createDeepAgent`, subagents (`tax-researcher`, `client-analyst`, `workbook-builder`, `reviewer`), Postgres checkpointer, background runs + resumable streaming | Multi-jurisdiction research and 300-asset workbooks complete reliably |
| **6** | Hardening | Tracing/observability, rate limits and per-user budgets, retention policy, fallback model, load testing | Ready for wider internal use |

Why Excel comes before RAG: the spreadsheet tool needs no data ingestion, so it's the quickest way to prove the agent + tool + streaming + file-download path end-to-end.

## Decision log

Add a row whenever the design changes. Newest at the bottom.

| # | Date | Decision | Why | Revisit if |
|---|---|---|---|---|
| D1 | 2026-09-24 | Single orchestrator agent with tools first (`createAgent`); subagents only in Phase 5 | Lower cost/latency, easier debugging; most questions fit one agent | Context overflow, long multi-source research, or evals show a sub-task needs isolation |
| D2 | 2026-09-24 | RAG store = PostgreSQL + pgvector, hybrid search (vector + full-text) + reranker | Already on Postgres; SQL permission filters; exact-term search matters for tax cites | >~10M chunks, or retrieval quality plateaus → consider Azure AI Search |
| D3 | 2026-09-24 | Excel generation is a tool (model → JSON spec → ExcelJS), not a subagent | Deterministic file building; model only decides content | Large multi-sheet/data-heavy workbooks → `workbook-builder` subagent (Phase 5) |
| D4 | 2026-09-24 | Numbers are always computed by code (`calculate`, spreadsheet formulas) | Models make arithmetic mistakes | Never |
| D5 | 2026-09-24 | Every chunk carries jurisdiction, tax year, authority level; filters applied before search | Correctness for the year/state asked; prior-year work | — |
| D6 | 2026-09-24 | Structured client data via SQL tools; only prose goes to RAG | Exactness | — |
| D7 | 2026-09-24 | Permission checks inside tools (`makeTools(user)`), never delegated to the prompt | Model can be wrong or manipulated | Never |
| D8 | 2026-09-24 | Models referenced by role in `lib/ai/models.ts` | Swap models without touching agent code | — |
| D9 | 2026-09-24 | Agent runs inside the Next.js route for L2; background worker for L3 | Simple now; long runs exceed request lifetimes later | When runs regularly exceed ~60s |

## Open questions

- **Main model:** is DeepSeek-V4-Pro's tool calling on Foundry reliable enough? (Test before Phase 2.)
- **Corpus:** which sources first (federal only, or specific states)? Any licensed tax research we're allowed to ingest?
- **Tenancy:** only one firm/user, or multiple firms with separate data? (Affects every table: add `firm_id` early if multi-firm is likely.)
- **File storage:** Azure Blob Storage vs. local disk vs. Postgres `bytea` for generated and uploaded files.
- **Hosting for background runs** (Phase 5): Azure Container Apps job, a worker process next to Next.js, or LangGraph's own server.
- **Client data rules:** consent and safeguards before real taxpayer data goes to a model (see [04](./04-client-data-and-security.md)).
- **Retention:** how long to keep chats, audit logs, and generated files.

## Instructions for AI agents updating this folder

- Keep the README's "Where we are today" table accurate when a phase lands.
- When code and docs disagree, don't silently "fix" either one; point out the mismatch.
- Add to the decision log instead of rewriting history; mark reversed decisions as "Superseded by D#".
- Keep explanations beginner-friendly: define new terms inline or in the README glossary.
