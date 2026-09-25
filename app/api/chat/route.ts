import { createUIMessageStreamResponse, safeValidateUIMessages } from "ai";
import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import { SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { lcChatModel } from "@/lib/ai/langchain";
import { getCurrentUser } from "@/lib/session";

// No database yet: the browser sends the whole conversation each time.
const Body = z.object({ messages: z.array(z.unknown()).min(1).max(100) });

export async function POST(req: Request) {
  // 1. Who is this? (proxy.ts only checked that a cookie exists)
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // 2. Check the conversation has the right shape
  const body = Body.safeParse(await req.json());
  if (!body.success) return new Response("Bad request", { status: 400 });
  const checked = await safeValidateUIMessages({ messages: body.data.messages });
  if (!checked.success) return new Response("Bad request", { status: 400 });
  const messages = checked.data;

  // Only user and assistant turns from the browser; the system instructions come from us.
  if (messages.some((m) => m.role !== "user" && m.role !== "assistant")) {
    return new Response("Bad request", { status: 400 });
  }
  if (messages.at(-1)?.role !== "user") return new Response("Bad request", { status: 400 });

  // 3. LangChain sends the conversation to Foundry (DeepSeek) and streams the answer
  const lcStream = await lcChatModel.stream([
    new SystemMessage("You are Nam-AI, a helpful assistant."),
    ...(await toBaseMessages(messages)), // AI SDK messages -> LangChain messages
  ]);

  // 4. Convert LangChain's stream into the format useChat understands
  return createUIMessageStreamResponse({ stream: toUIMessageStream(lcStream) });
}
