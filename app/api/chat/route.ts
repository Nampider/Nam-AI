import {
  consumeStream, createIdGenerator, createUIMessageStream, createUIMessageStreamResponse, safeValidateUIMessages,
} from "ai";
import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import { SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { lcChatModel } from "@/lib/ai/langchain";
import { getCurrentUser } from "@/lib/session";
import { getOrCreateConversation, loadMessages, saveMessage, touchConversation } from "@/db/queries";

// The browser sends only the newest message; the history comes from Postgres.
const Body = z.object({ id: z.uuid(), message: z.unknown() });

export async function POST(req: Request) {
  // 1. Who is this? (proxy.ts only checked that a cookie exists)
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // 2. Check the request has the right shape
  const body = Body.safeParse(await req.json());
  if (!body.success) return new Response("Bad request", { status: 400 });
  const chatId = body.data.id;

  // 3. History from Postgres + the new message, checked for the right shape
  const previous = await loadMessages(chatId, user.id);
  const checked = await safeValidateUIMessages({ messages: [...previous, body.data.message] });
  if (!checked.success) return new Response("Bad request", { status: 400 });
  const messages = checked.data;

  const newMessage = messages.at(-1)!;
  if (newMessage.role !== "user") return new Response("Bad request", { status: 400 });

  // 4. Create the chat if new (404 if the id is someone else's), then save the user's message
  const chat = await getOrCreateConversation(chatId, user.id, newMessage);
  if (!chat) return new Response("Not found", { status: 404 });
  await saveMessage(chatId, newMessage);

  // 5. LangChain sends the conversation to Foundry and streams the answer back
  const lcStream = await lcChatModel.stream([
    new SystemMessage("You are Nam-AI, a helpful assistant."),
    ...(await toBaseMessages(messages)),
  ]);

  // 6. Stream in useChat's format, then save the finished answer
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages: messages,
      generateId: createIdGenerator({ prefix: "msg", size: 16 }),
      execute: ({ writer }) => writer.merge(toUIMessageStream(lcStream)),
      onEnd: async ({ responseMessage }) => {
        await saveMessage(chatId, responseMessage);
        await touchConversation(chatId); // moves the chat to the top of the sidebar
      },
    }),
    consumeSseStream: consumeStream, // keep going (and saving) even if the tab closes
  });
}
