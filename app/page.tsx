import { redirect } from "next/navigation";
import { connection } from "next/server";

// "/" always starts a fresh chat with a new random id.
export default async function Home() {
  await connection(); // render per request, so every visit gets its own id
  redirect(`/chat/${crypto.randomUUID()}`);
}
