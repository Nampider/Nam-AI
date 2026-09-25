import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import type { UIMessage } from "ai";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";

// Every function takes the signed-in user's id, so one user can never reach another's chats.

export function listConversations(userId: string) {
  return db
    .select({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
}

export function titleFrom(message: UIMessage) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
  return text.slice(0, 60) || "New conversation";
}

/** Creates the chat on its first message. Returns null if the id already belongs to another user. */
export async function getOrCreateConversation(id: string, userId: string, first: UIMessage) {
  await db.insert(conversations).values({ id, userId, title: titleFrom(first) }).onConflictDoNothing();
  const [chat] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  return chat ?? null;
}

/** Oldest first. Returns [] for a new chat, or one owned by someone else. */
export async function loadMessages(conversationId: string, userId: string): Promise<UIMessage[]> {
  const rows = await db
    .select({ id: messages.id, role: messages.role, parts: messages.parts, metadata: messages.metadata })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(messages.conversationId, conversationId), eq(conversations.userId, userId)))
    .orderBy(asc(messages.createdAt));
  return rows.map(({ metadata, ...m }) => (metadata ? { ...m, metadata } : m)) as UIMessage[];
}

export async function saveMessage(conversationId: string, m: UIMessage) {
  await db
    .insert(messages)
    .values({
      id: m.id,
      conversationId,
      role: m.role,
      parts: m.parts,
      metadata: (m.metadata ?? null) as Record<string, unknown> | null,
    })
    .onConflictDoNothing(); // a retried request won't create a duplicate bubble
}

export async function touchConversation(id: string) {
  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, id));
}

export async function deleteConversation(id: string, userId: string) {
  await db.delete(conversations) // its messages go too, via ON DELETE CASCADE
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}
