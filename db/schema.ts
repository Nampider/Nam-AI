import { pgTable, pgEnum, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import type { UIMessage } from "ai";
import { user } from "./auth-schema";

export * from "./auth-schema";

export const messageRole = pgEnum("message_role", ["system", "user", "assistant"]);

// One row per chat in the sidebar.
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey(), // made in the browser, so a row only appears on the first message
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_user_updated_idx").on(t.userId, t.updatedAt.desc())],
);

// One row per chat bubble. `parts` stores the AI SDK message parts (text, tool calls...) as JSON.
export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRole("role").notNull(),
    parts: jsonb("parts").$type<UIMessage["parts"]>().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_created_idx").on(t.conversationId, t.createdAt)],
);
