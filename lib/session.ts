import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// The one function every server file uses to ask "who is signed in?"
export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null; // null = not signed in
}
