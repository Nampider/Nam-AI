"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { deleteConversation } from "@/db/queries";

export async function deleteChatAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  if (!z.uuid().safeParse(id).success) return;
  await deleteConversation(id, user.id); // only deletes if this user owns it
  revalidatePath("/chat", "layout"); // refresh the sidebar
}
