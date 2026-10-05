import { api } from "./api";
import type { Conversation, Message, MessageAttachment } from "../Types/Artist";

export async function listConversationsApi(): Promise<Conversation[]> {
  const { data } = await api.get<Conversation[]>("/messages/conversations");
  return data;
}

export async function getMessagesApi(
  conversationId: string
): Promise<Message[]> {
  const { data } = await api.get<Message[]>(
    `/messages/conversations/${conversationId}/messages`
  );
  return data;
}

export async function sendMessageApi(input: {
  conversationId: string;
  senderName: string;
  body: string;
  attachment?: MessageAttachment;
}): Promise<Message> {
  const { data } = await api.post<Message>(
    `/messages/conversations/${input.conversationId}/messages`,
    {
      body: input.body,
      senderName: input.senderName,
      attachment: input.attachment,
    },
    // Uploads with a 2 MB file can take a while on mobile data
    { timeout: input.attachment ? 60000 : 20000 }
  );
  return data;
}

/** Open (or reuse) the chat for a booking — the server works out who's in it */
export async function ensureConversationApi(input: {
  bookingId: string;
  initialMessage?: string;
}): Promise<Conversation> {
  const { data } = await api.post<Conversation>("/messages/conversations", input);
  return data;
}

/** Fetch an attachment with the user's auth header and save it */
export async function downloadAttachmentApi(attachment: MessageAttachment): Promise<void> {
  const { data } = await api.get<Blob>(
    `/messages/attachments/${encodeURIComponent(attachment.id!)}`,
    { responseType: "blob", timeout: 60000 }
  );
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = attachment.name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function totalUnreadApi(): Promise<number> {
  const { data } = await api.get<{ count: number }>("/messages/unread-count");
  return data.count;
}
