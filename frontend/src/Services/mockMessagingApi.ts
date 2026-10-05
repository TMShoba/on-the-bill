import axios from "axios";
import type { Conversation, Message, MessageAttachment } from "../Types/Artist";
import {
  listConversationsApi,
  getMessagesApi,
  sendMessageApi,
  ensureConversationApi,
  totalUnreadApi,
} from "./messagingService";

const CONV_KEY = "otb_conversations";
const MSG_KEY = "otb_messages";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Only fall back to the browser copy when the API can't be reached. A real
 * error (403, 400 "file too large"…) must surface, or the sender would think
 * a message was delivered that the other side never receives.
 */
function isApiUnreachable(e: unknown): boolean {
  return axios.isAxiosError(e) && !e.response;
}

function uid() {
  return crypto.randomUUID();
}

/** Local-only fallbacks when API is offline */
const local = {
  async listConversations(userId: string): Promise<Conversation[]> {
    const all = read<Conversation[]>(CONV_KEY, []);
    return all
      .filter((c) => c.artistId === userId || c.promoterId === userId)
      .map((c) => {
        const msgs = read<Message[]>(MSG_KEY, []).filter(
          (m) => m.conversationId === c.id
        );
        const unread = msgs.filter(
          (m) => !m.read && m.senderId !== userId
        ).length;
        return { ...c, unreadCount: unread };
      })
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  },

  async getMessages(
    conversationId: string,
    userId: string
  ): Promise<Message[]> {
    const msgs = read<Message[]>(MSG_KEY, [])
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const updated = read<Message[]>(MSG_KEY, []).map((m) =>
      m.conversationId === conversationId && m.senderId !== userId
        ? { ...m, read: true }
        : m
    );
    write(MSG_KEY, updated);

    return msgs.map((m) =>
      m.senderId !== userId ? { ...m, read: true } : m
    );
  },

  async sendMessage(input: {
    conversationId: string;
    senderId: string;
    senderName: string;
    body: string;
    attachment?: MessageAttachment;
  }): Promise<Message> {
    const preview = input.attachment
      ? `📎 ${input.attachment.name}${input.body ? ` — ${input.body}` : ""}`
      : input.body;

    const msg: Message = {
      id: uid(),
      conversationId: input.conversationId,
      senderId: input.senderId,
      senderName: input.senderName,
      body:
        input.body ||
        (input.attachment ? `Sent ${input.attachment.name}` : ""),
      createdAt: new Date().toISOString(),
      read: false,
      attachment: input.attachment,
    };
    const msgs = read<Message[]>(MSG_KEY, []);
    msgs.push(msg);
    write(MSG_KEY, msgs);

    const convs = read<Conversation[]>(CONV_KEY, []);
    const idx = convs.findIndex((c) => c.id === input.conversationId);
    if (idx >= 0) {
      const conv = convs[idx];
      convs[idx] = {
        ...conv,
        lastMessageAt: msg.createdAt,
        lastMessagePreview: preview.slice(0, 80),
      };
      write(CONV_KEY, convs);
    }

    return msg;
  },

  async ensureConversationForBooking(input: {
    bookingId: string;
    artistId: string;
    artistName: string;
    promoterId: string;
    promoterName: string;
    initialMessage?: string;
  }): Promise<Conversation> {
    const convs = read<Conversation[]>(CONV_KEY, []);
    let existing = convs.find((c) => c.bookingId === input.bookingId);
    if (existing) return existing;

    const now = new Date().toISOString();
    const conv: Conversation = {
      id: uid(),
      bookingId: input.bookingId,
      artistId: input.artistId,
      artistName: input.artistName,
      promoterId: input.promoterId,
      promoterName: input.promoterName,
      lastMessageAt: now,
      lastMessagePreview:
        input.initialMessage?.slice(0, 80) || "Booking request",
      unreadCount: 0,
    };
    convs.push(conv);
    write(CONV_KEY, convs);

    if (input.initialMessage) {
      await this.sendMessage({
        conversationId: conv.id,
        senderId: input.promoterId,
        senderName: input.promoterName,
        body: input.initialMessage,
      });
    }

    return conv;
  },

  async totalUnread(userId: string): Promise<number> {
    const convs = await this.listConversations(userId);
    return convs.reduce((sum, c) => sum + c.unreadCount, 0);
  },
};

/**
 * Messaging API — prefers server SQLite, falls back to localStorage if offline.
 * Keeps the same surface as the original mock so UI components stay unchanged.
 */
export const mockMessagingApi = {
  async listConversations(userId: string): Promise<Conversation[]> {
    try {
      return await listConversationsApi();
    } catch (e) {
      if (!isApiUnreachable(e)) throw e;
      console.warn("Messages API offline, using local conversations", e);
      return local.listConversations(userId);
    }
  },

  async getMessages(
    conversationId: string,
    userId: string
  ): Promise<Message[]> {
    try {
      return await getMessagesApi(conversationId);
    } catch (e) {
      if (!isApiUnreachable(e)) throw e;
      console.warn("Messages API offline, using local messages", e);
      return local.getMessages(conversationId, userId);
    }
  },

  async sendMessage(input: {
    conversationId: string;
    senderId: string;
    senderName: string;
    body: string;
    attachment?: MessageAttachment;
  }): Promise<Message> {
    try {
      const msg = await sendMessageApi({
        conversationId: input.conversationId,
        senderName: input.senderName,
        body: input.body,
        attachment: input.attachment,
      });
      // The API notifies the other party
      return msg;
    } catch (e) {
      if (!isApiUnreachable(e)) throw e;
      console.warn("sendMessage API failed, local fallback", e);
      return local.sendMessage(input);
    }
  },

  async ensureConversationForBooking(input: {
    bookingId: string;
    artistId: string;
    artistName: string;
    promoterId: string;
    promoterName: string;
    initialMessage?: string;
  }): Promise<Conversation> {
    try {
      return await ensureConversationApi({
        bookingId: input.bookingId,
        initialMessage: input.initialMessage,
      });
    } catch (e) {
      if (!isApiUnreachable(e)) throw e;
      console.warn("ensureConversation API failed, local fallback", e);
      return local.ensureConversationForBooking(input);
    }
  },

  async totalUnread(userId: string): Promise<number> {
    try {
      return await totalUnreadApi();
    } catch (e) {
      if (!isApiUnreachable(e)) throw e;
      console.warn("unread API offline, using local", e);
      return local.totalUnread(userId);
    }
  },
};

/** Must match ALLOWED_ATTACHMENT_TYPES / MAX_ATTACHMENT_BYTES in backend/src/routes/messages.js */
export const ATTACHMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg";
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "image/png",
  "image/jpeg",
]);
const MAX_BYTES = 2 * 1024 * 1024;

/** Read a File into a MessageAttachment for upload */
export function fileToAttachment(file: File): Promise<MessageAttachment> {
  if (file.size > MAX_BYTES) {
    return Promise.reject(new Error("Files must be 2 MB or smaller."));
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Promise.reject(
      new Error("Send a PDF, Word, Excel, text or image (PNG/JPG) file.")
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: String(reader.result),
      });
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
