"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { LogOut, SquarePen, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { authClient } from "@/lib/auth-client";
import { deleteChatAction } from "@/app/chat/actions";

export type ChatSummary = { id: string; title: string; updatedAt: Date };

export function Chat({
  user, chats, activeId, initialMessages,
}: {
  user: { name: string; email: string };
  chats: ChatSummary[];
  activeId: string;
  initialMessages: UIMessage[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const { messages, sendMessage, status, stop, error } = useChat({
    id: activeId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // only the newest message goes over the wire; the server has the rest
      prepareSendMessagesRequest: ({ messages, id }) => ({ body: { id, message: messages.at(-1) } }),
    }),
    onFinish: () => router.refresh(), // new chat appears in the sidebar / moves to the top
  });

  const newChat = () => router.push(`/chat/${crypto.randomUUID()}`);

  const remove = (id: string) =>
    startTransition(async () => {
      await deleteChatAction(id);
      if (id === activeId) newChat();
      else router.refresh();
    });

  // DeepSeek works through its reasoning before writing; show a hint until the first words land.
  const last = messages.at(-1);
  const waiting =
    status === "submitted" ||
    (status === "streaming" &&
      last?.role === "assistant" &&
      !last.parts.some((p) => p.type === "text" && p.text.length > 0));

  return (
    <div className="flex h-dvh">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center justify-between px-3">
          <span className="text-sm font-semibold">Nam-AI</span>
          <Button variant="ghost" size="icon-sm" aria-label="New chat" onClick={newChat}>
            <SquarePen />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {chats.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No conversations yet</p>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md pr-1 pl-2 text-sm",
                  chat.id === activeId ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <Link href={`/chat/${chat.id}`} className="min-w-0 flex-1 truncate py-1.5">
                  {chat.title}
                </Link>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Delete conversation"
                  className="opacity-0 group-hover:opacity-100"
                  disabled={pending}
                  onClick={() => remove(chat.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          )}
        </nav>

        <div className="flex items-center gap-1 border-t p-2">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{user.name || user.email}</span>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Sign out"
            onClick={async () => {
              await authClient.signOut();
              router.push("/sign-in");
            }}
          >
            <LogOut />
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between border-b px-3 md:hidden">
          <span className="text-sm font-semibold">Nam-AI</span>
          <Button variant="ghost" size="icon-sm" aria-label="New chat" onClick={newChat}>
            <SquarePen />
          </Button>
        </div>

        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl">
            {messages.map((m) => (
              <Message from={m.role} key={m.id}>
                <MessageContent>
                  {m.parts.map((part, i) =>
                    part.type === "text" ? <MessageResponse key={i}>{part.text}</MessageResponse> : null,
                  )}
                </MessageContent>
              </Message>
            ))}
            {waiting && <p className="text-sm text-muted-foreground">Thinking...</p>}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {error && (
          <p className="mx-auto w-full max-w-3xl px-4 text-sm text-destructive">
            Something went wrong sending that message. Please try again.
          </p>
        )}

        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <PromptInput
            onSubmit={(message: PromptInputMessage) => {
              const text = message.text?.trim();
              if (text) sendMessage({ text });
            }}
          >
            <PromptInputBody>
              <PromptInputTextarea placeholder="Ask anything..." />
            </PromptInputBody>
            <PromptInputFooter>
              <span />
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </main>
    </div>
  );
}
