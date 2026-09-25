import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Chat } from "@/components/chat";
import { getCurrentUser } from "@/lib/session";
import { listConversations, loadMessages } from "@/db/queries";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // Both come straight from Postgres, scoped to this user.
  const [chats, initialMessages] = await Promise.all([
    listConversations(user.id),
    loadMessages(id, user.id), // [] for a new chat, or one owned by someone else
  ]);

  return (
    <Chat
      key={id} // switching chats remounts the pane with that chat's messages
      user={{ name: user.name, email: user.email }}
      chats={chats}
      activeId={id}
      initialMessages={initialMessages}
    />
  );
}
