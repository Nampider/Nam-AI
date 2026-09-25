<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AI architecture — read before any AI work

The design for Nam-AI's AI system (agent, tools, subagents, RAG / vector search, client data, Excel generation, models) lives in [`AI_ARCHITECTURE/`](./AI_ARCHITECTURE/README.md).

Before changing `lib/ai/**`, `app/api/chat/**`, any agent tool, embedding/RAG code, spreadsheet generation, or related database tables:

1. Read `AI_ARCHITECTURE/README.md` (principles + current status), then the numbered doc for the area you're touching.
2. Follow its non-negotiable principles (numbers computed by code, cited sources, permission checks inside tools, one agent before many).
3. If your change departs from the design, say so before coding. If you change the design, update the docs in the same change and add a row to the decision log in `AI_ARCHITECTURE/07-roadmap-and-decisions.md`.
