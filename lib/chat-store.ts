"use client";

import type { UIMessage } from "ai";

// Conversations are kept in this browser's local storage until the app has a database.
// Swapping in Postgres later means replacing this file, not the components.

export type StoredChat = {
  id: string;
  title: string;
  updatedAt: number;
  messages: UIMessage[];
};

const KEY = "nam-ai.chats";
const MAX_CHATS = 50;
const EMPTY: StoredChat[] = [];

let cachedRaw = "";
let cached: StoredChat[] = EMPTY;
const listeners = new Set<() => void>();

/** React subscribes here; the storage event keeps other tabs in step. */
export function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function getChats(): StoredChat[] {
  try {
    const raw = window.localStorage.getItem(KEY) ?? "[]";
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cached = JSON.parse(raw) as StoredChat[];
    }
  } catch {
    cached = EMPTY; // private windows and blocked storage land here
  }
  return cached;
}

/** The server has no local storage, so it renders an empty list. */
export function getServerChats(): StoredChat[] {
  return EMPTY;
}

function write(next: StoredChat[]) {
  const trimmed = next.slice(0, MAX_CHATS);
  try {
    cachedRaw = JSON.stringify(trimmed);
    cached = trimmed;
    window.localStorage.setItem(KEY, cachedRaw);
  } catch {
    cached = trimmed;
  }
  for (const listener of listeners) listener();
}

export function saveChat(chat: StoredChat) {
  const others = getChats().filter((c) => c.id !== chat.id);
  write([chat, ...others].sort((a, b) => b.updatedAt - a.updatedAt));
}

export function deleteChat(id: string) {
  write(getChats().filter((c) => c.id !== id));
}

export function titleFrom(messages: UIMessage[]) {
  const firstUser = messages.find((m) => m.role === "user");
  const text = (firstUser?.parts ?? [])
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .trim();
  return text.slice(0, 60) || "New conversation";
}
