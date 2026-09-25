# Nam-AI — AI Architecture

> **AI coding agents (Claude, Codex, Cursor, Copilot, etc.): this folder is the source of truth for how Nam-AI's AI works.**
> Read this README before touching `lib/ai/**`, `app/api/chat/**`, any agent tool, RAG / embedding code, spreadsheet generation, or the database tables listed in these docs.
> If a change you're asked to make conflicts with a decision here, point out the conflict before writing code.
> If you change the design, update the matching doc **in the same change** and add an entry to the decision log in [07-roadmap-and-decisions.md](./07-roadmap-and-decisions.md).

Last updated: 2026-09-24

## What Nam-AI is

Nam-AI is an internal chat assistant **for accountants**. An accountant asks a tax or accounting question (general, or about a specific client), and the AI answers with:

- an explanation in plain language,
- **citations** to the tax law, regulation, or document it relied on (with jurisdiction and tax year),
- numbers that were **calculated by code**, not guessed by the model,
- and, when asked, a **downloadable Excel workbook** (for example a depreciation schedule or a Section 179 worksheet).

## Where we are today (Phase 0)

| Piece | Current state |
|---|---|
| Model | One model: DeepSeek-V4-Pro on Microsoft Foundry, called through LangChain `ChatOpenAI` (`lib/ai/langchain.ts`) |
| Agent | None yet. `app/api/chat/route.ts` streams a plain chat reply with a one-line system prompt |
| Tools | None |
| Knowledge (RAG) | None |
| Chat history | Browser localStorage (`lib/chat-store.ts`); Postgres persistence is planned |
| Spreadsheets | None |

## The short answer to "what should the architecture be?"

1. **One main agent first, not a team of agents.** A single "orchestrator" model that can call **tools** (search tax law, look up client data, calculate, build a spreadsheet) covers most of what an accountant asks. Multi-agent setups cost more, run slower, and are harder to debug; add them only when a real problem needs them.
2. **Multiple models, yes — but for different jobs, not multiple "brains".** A large reasoning model for the main agent, a small fast model for chores (chat titles, rewriting search queries), an embedding model for RAG, and a reranker. See [06](./06-models-and-routing.md).
3. **Excel generation is a tool, not a subagent** (at first). The model decides *what* goes in the workbook as structured JSON; plain TypeScript code (ExcelJS) builds the file. A "workbook-builder" subagent is added later only for big multi-sheet jobs. See [05](./05-excel-generation.md).
4. **RAG on Postgres + pgvector**, with hybrid search (meaning-based + exact keyword) and strict filters for **jurisdiction** and **tax year**. See [03](./03-rag-knowledge-base.md).
5. **Deep agents (LangChain `deepagents`) are Phase 5**, used for long research tasks that read many documents, through subagents that keep the main conversation's context clean. See [02](./02-agent-orchestration.md).

## Reading order

| # | File | Read it when you're working on… |
|---|---|---|
| 01 | [01-overview.md](./01-overview.md) | Anything — the big picture and the layers |
| 02 | [02-agent-orchestration.md](./02-agent-orchestration.md) | The agent loop, tools, subagents, streaming, `app/api/chat` |
| 03 | [03-rag-knowledge-base.md](./03-rag-knowledge-base.md) | Ingestion, embeddings, vector search, citations |
| 04 | [04-client-data-and-security.md](./04-client-data-and-security.md) | Client data, permissions, PII, audit logging, prompt injection |
| 05 | [05-excel-generation.md](./05-excel-generation.md) | Creating or reading spreadsheets |
| 06 | [06-models-and-routing.md](./06-models-and-routing.md) | Which model does what, config, fallbacks, evaluation |
| 07 | [07-roadmap-and-decisions.md](./07-roadmap-and-decisions.md) | Build order, decision log, open questions |

## Non-negotiable principles

These apply to every phase. Code that breaks one of these needs an explicit decision in the log.

1. **Numbers come from code.** The model never does arithmetic "in its head" for an answer. It calls a calculation tool or builds a spreadsheet whose formulas do the math.
2. **Every tax or legal claim cites a retrieved source** (with jurisdiction and tax year). If nothing relevant was retrieved, the AI says so instead of answering from memory.
3. **Permissions live in code, not in prompts.** A tool only ever returns data the signed-in user is allowed to see. The model is never trusted to "remember" who may see what.
4. **Start with one agent.** Add a router, subagent, or extra model only when a measured problem (cost, latency, context overflow, quality) requires it.
5. **Everything the AI did is logged**: which tools it called, with what inputs, which sources it used. Accountants need an audit trail.
6. **The AI assists a licensed professional.** It drafts, researches, and calculates; it does not file, send, or change anything outside Nam-AI without a human approving it.
7. **Retrieved text is data, not instructions.** Content from documents (especially client uploads) can never change the AI's rules or trigger actions.

## Glossary (plain-language)

| Term | Meaning |
|---|---|
| **LLM / model** | The AI text engine (e.g. DeepSeek-V4-Pro). Given text in, it predicts text out. |
| **Token** | A chunk of text (~¾ of a word). Models are priced and limited by tokens. |
| **Context window** | The maximum amount of text (in tokens) a model can "see" at once: instructions + chat history + retrieved documents + tool results. |
| **Hallucination** | When a model states something confidently that isn't true (e.g. a made-up code section). |
| **Tool** | A normal function in our code that the model may ask us to run (e.g. `search_tax_authority`). The model sends arguments as JSON; we run it and send the result back. |
| **Agent** | A model running in a loop: think → call a tool → read the result → repeat → final answer. |
| **Orchestrator** | The main agent the user talks to. It decides which tools or subagents to use. |
| **Subagent** | A separate agent the orchestrator can hand a sub-task to. It has its own instructions and tools and returns only a short report, so its long working notes don't fill up the orchestrator's context window. |
| **Deep agent** | LangChain's `deepagents` package: an agent harness with built-in planning (to-do list), a scratch file system, and subagents, meant for long multi-step tasks. |
| **Middleware** | Code that wraps each model/tool call in the agent loop (e.g. summarize old messages, cap the number of tool calls, mask Social Security numbers). |
| **RAG** | Retrieval-Augmented Generation: before answering, search our own documents and paste the most relevant passages into the model's context so it answers from them. |
| **Embedding** | A list of numbers representing the *meaning* of a piece of text. Texts with similar meanings get similar numbers. |
| **Vector database / pgvector** | Storage that can find the embeddings closest to a query's embedding. pgvector adds this to our existing PostgreSQL. |
| **Chunk** | A small piece of a document (a few paragraphs, ideally one code section/subsection) that gets its own embedding. |
| **Hybrid search** | Running meaning-based (vector) search and exact keyword search together and merging the results. |
| **Reranker** | A model that re-scores search results for relevance to the question; slower but more accurate than the first search. |
| **Checkpointer** | Saves an agent's in-progress state to the database so a run can pause (e.g. wait for human approval) and resume later. |
| **Eval** | An automated test for AI quality: a set of questions with known good answers, scored after every change. |
