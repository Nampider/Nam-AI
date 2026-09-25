"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
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
import {
  deleteChat, getChats, getServerChats, saveChat, subscribe, titleFrom, type StoredChat,
} from "@/lib/chat-store";

export function Chat({ userName, userEmail }: { userName: string; userEmail: string }) {
  const router = useRouter();
  const chats = useSyncExternalStore(subscribe, getChats, getServerChats);
  const [activeId, setActiveId] = useState(() => crypto.randomUUID());
  const active = chats.find((c) => c.id === activeId);

  const newChat = () => setActiveId(crypto.randomUUID());

  const remove = (id: string) => {
    deleteChat(id);
    if (id === activeId) newChat();
  };

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
            groupByAge(chats).map((group) => (
              <div key={group.label} className="mb-3">
                <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">{group.label}</p>
                {group.items.map((chat) => (
                  <div
                    key={chat.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-md pr-1 pl-2 text-sm",
                      chat.id === activeId ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveId(chat.id)}
                      className="min-w-0 flex-1 truncate py-1.5 text-left"
                    >
                      {chat.title}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Delete conversation"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={() => remove(chat.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            ))
          )}
        </nav>

        <div className="flex items-center gap-1 border-t p-2">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{userName || userEmail}</span>
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

        {/* key: switching conversations remounts the pane with that conversation's messages */}
        <ChatPane key={activeId} id={activeId} initialMessages={active?.messages ?? []} />
      </main>
    </div>
  );
}

function ChatPane({ id, initialMessages }: { id: string; initialMessages: UIMessage[] }) {
  const { messages, sendMessage, status, stop, error } = useChat({
    id,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const savedCount = useRef(initialMessages.length);

  // Save the conversation once each answer is complete.
  useEffect(() => {
    if (status !== "ready" || messages.length === 0) return;
    if (messages.length === savedCount.current) return;
    savedCount.current = messages.length;
    saveChat({ id, title: titleFrom(messages), updatedAt: Date.now(), messages });
  }, [id, messages, status]);

  // DeepSeek works through its reasoning before writing; show a hint until the first words land.
  const last = messages.at(-1);
  const waiting =
    status === "submitted" ||
    (status === "streaming" &&
      last?.role === "assistant" &&
      !last.parts.some((p) => p.type === "text" && p.text.length > 0));

  return (
    <>
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
    </>
  );
}

function groupByAge(chats: StoredChat[]) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const weekAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;
  const groups = [
    { label: "Today", items: [] as StoredChat[] },
    { label: "Previous 7 days", items: [] as StoredChat[] },
    { label: "Older", items: [] as StoredChat[] },
  ];
  for (const chat of chats) {
    const bucket = chat.updatedAt >= startOfToday ? 0 : chat.updatedAt >= weekAgo ? 1 : 2;
    groups[bucket].items.push(chat);
  }
  return groups.filter((g) => g.items.length > 0);
}
