import { redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { getCurrentUser } from "@/lib/session";

// The chat screen. Server component: it checks the session before rendering anything.
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return <Chat userName={user.name} userEmail={user.email} />;
}
