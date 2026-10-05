import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  mockMessagingApi,
  fileToAttachment,
  ATTACHMENT_ACCEPT,
} from "../../Services/mockMessagingApi";
import { downloadAttachmentApi } from "../../Services/messagingService";
import { useAuth } from "../../context/AuthContext";
import type { Conversation, MessageAttachment } from "../../Types/Artist";

/** "Printworks London · 12 Dec 2026" */
function bookingLabel(c: Conversation) {
  const date = c.bookingDate
    ? new Date(`${c.bookingDate}T12:00:00`).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
  return [c.bookingVenue, date].filter(Boolean).join(" · ");
}

function errorMessage(e: unknown, fallback: string) {
  return (axios.isAxiosError(e) && e.response?.data?.message) || fallback;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  /** "page" = dedicated /messages route (taller, mobile list↔chat). Default embedded in dashboard. */
  variant?: "embedded" | "page";
};

export default function MessagesPanel({ variant = "embedded" }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [pendingFile, setPendingFile] = useState<MessageAttachment | null>(
    null
  );
  const [fileError, setFileError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const isPage = variant === "page";

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => mockMessagingApi.listConversations(user!.id),
    enabled: Boolean(user),
    refetchInterval: 5000,
  });

  // Poll the open thread so replies show up without reopening the chat
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", activeId],
    queryFn: () => mockMessagingApi.getMessages(activeId!, user!.id),
    enabled: Boolean(activeId && user),
    refetchInterval: 4000,
  });

  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    // New message in view: stick to the bottom and refresh unread badges
    // (opening the thread marks the other side's messages read)
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    if (lastMessageId) {
      qc.invalidateQueries({ queryKey: ["unread", user?.id] });
      qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
    }
  }, [lastMessageId, activeId, qc, user?.id]);

  async function downloadAttachment(att: MessageAttachment) {
    if (!att.id) return;
    setDownloading(att.id);
    setFileError("");
    try {
      await downloadAttachmentApi(att);
    } catch (e) {
      setFileError(errorMessage(e, "Could not download that file"));
    } finally {
      setDownloading(null);
    }
  }

  // The draft is passed in as variables: onMutate clears the input, and the
  // mutationFn must not read the (by then empty) component state
  const sendMut = useMutation({
    mutationFn: (draft: { text: string; att: MessageAttachment | null }) =>
      mockMessagingApi.sendMessage({
        conversationId: activeId!,
        senderId: user!.id,
        senderName: user!.name || "You",
        body: draft.text,
        attachment: draft.att || undefined,
      }),
    onMutate: async ({ text, att }) => {
      // Clear input immediately for snappy UX
      setBody("");
      setPendingFile(null);
      setFileError("");
      if (fileRef.current) fileRef.current.value = "";

      await qc.cancelQueries({ queryKey: ["messages", activeId] });
      const prev = qc.getQueryData<unknown[]>(["messages", activeId]);

      // Optimistic bubble so the message always appears
      const optimistic = {
        id: `temp-${Date.now()}`,
        conversationId: activeId!,
        senderId: user!.id,
        senderName: user!.name || "You",
        body: text || (att ? `Sent ${att.name}` : ""),
        createdAt: new Date().toISOString(),
        read: true,
        attachment: att || undefined,
      };
      qc.setQueryData(["messages", activeId], (old: unknown) => {
        const list = Array.isArray(old) ? old : [];
        return [...list, optimistic];
      });
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(["messages", activeId], ctx.prev);
      }
      setFileError(errorMessage(err, "Could not send — try again"));
    },
    onSuccess: (msg) => {
      // Replace optimistic temp message with server message
      qc.setQueryData(["messages", activeId], (old: unknown) => {
        const list = Array.isArray(old) ? [...old] : [];
        const withoutTemp = list.filter(
          (m: { id?: string }) => !String(m?.id || "").startsWith("temp-")
        );
        // Avoid duplicates if refetch already added it
        if (withoutTemp.some((m: { id?: string }) => m.id === msg.id)) {
          return withoutTemp;
        }
        return [...withoutTemp, msg];
      });
      qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
      qc.invalidateQueries({ queryKey: ["unread", user?.id] });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["messages", activeId] });
    },
  });

  async function onFileChange(file: File | null) {
    setFileError("");
    if (!file) {
      setPendingFile(null);
      return;
    }
    try {
      const att = await fileToAttachment(file);
      setPendingFile(att);
    } catch (e) {
      setPendingFile(null);
      setFileError((e as Error).message);
    }
  }

  if (!user) return null;

  const active = conversations.find((c) => c.id === activeId);
  const peerName = active
    ? user.role === "artist"
      ? active.promoterName
      : active.artistName
    : "";

  const shellClass = isPage
    ? "grid min-h-[calc(100dvh-8rem)] flex-1 overflow-hidden bg-white sm:min-h-[560px] sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-sm md:grid-cols-[300px_1fr]"
    : "grid min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[280px_1fr]";

  // On mobile page mode: show list OR thread (not both)
  const showListMobile = isPage && !activeId;
  const showThreadMobile = isPage && Boolean(activeId);

  return (
    <div className={shellClass}>
      {/* Conversation list */}
      <aside
        className={`border-b border-slate-200 md:border-b-0 md:border-r ${
          isPage
            ? showThreadMobile
              ? "hidden md:block"
              : "block"
            : ""
        }`}
      >
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">
          {isPage ? (
            <span className="sm:hidden">Messages</span>
          ) : null}
          <span className={isPage ? "hidden sm:inline" : ""}>Messages</span>
        </div>
        <ul
          className={
            isPage
              ? "max-h-[calc(100dvh-12rem)] overflow-y-auto md:max-h-[calc(100dvh-14rem)]"
              : "max-h-64 overflow-y-auto md:max-h-[380px]"
          }
        >
          {conversations.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-500">
              No conversations yet.
              <p className="mt-1 text-xs text-slate-400">
                They appear when a booking is requested.
              </p>
            </li>
          )}
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition hover:bg-slate-50 ${
                  activeId === c.id ? "bg-emerald-50/60" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">
                    {user.role === "artist" ? c.promoterName : c.artistName}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                {bookingLabel(c) && (
                  <span className="truncate text-[11px] font-medium text-emerald-700">
                    {bookingLabel(c)}
                  </span>
                )}
                <span className="truncate text-xs text-slate-500">
                  {c.lastMessagePreview || "No messages yet"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Thread */}
      <div
        className={`flex min-h-0 flex-col ${
          isPage
            ? showListMobile
              ? "hidden md:flex"
              : "flex"
            : "flex"
        }`}
      >
        {!activeId ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">
            Select a conversation
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
              {isPage && (
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
                  onClick={() => setActiveId(null)}
                  aria-label="Back to conversations"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">
                  {peerName}
                </p>
                <p className="truncate text-[11px] text-slate-400">
                  {(active && bookingLabel(active)) || "Booking chat"}
                </p>
              </div>
            </div>

            <div
              ref={threadRef}
              className={`flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4 ${
                isPage
                  ? "min-h-[40vh] max-h-[calc(100dvh-19rem)] md:max-h-[calc(100dvh-21rem)]"
                  : "max-h-64 md:max-h-[280px]"
              }`}
            >
              {messages.map((m) => {
                const mine = m.senderId === user.id;
                return (
                  <div
                    key={m.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                        mine
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-900"
                      }`}
                    >
                      {!mine && (
                        <p className="mb-0.5 text-[10px] font-semibold opacity-70">
                          {m.senderName}
                        </p>
                      )}
                      {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                      {m.attachment &&
                        (m.attachment.id ? (
                          <button
                            type="button"
                            onClick={() => downloadAttachment(m.attachment!)}
                            disabled={downloading === m.attachment.id}
                            className={`mt-1 block text-left text-xs underline disabled:opacity-60 ${
                              mine ? "text-emerald-200" : "text-emerald-700"
                            }`}
                          >
                            📎 {m.attachment.name} ({formatSize(m.attachment.size)})
                            {downloading === m.attachment.id ? " · downloading…" : ""}
                          </button>
                        ) : m.attachment.dataUrl ? (
                          <a
                            href={m.attachment.dataUrl}
                            download={m.attachment.name}
                            className={`mt-1 block text-xs underline ${
                              mine ? "text-emerald-200" : "text-emerald-700"
                            }`}
                          >
                            📎 {m.attachment.name} ({formatSize(m.attachment.size)})
                          </a>
                        ) : (
                          <p className="mt-1 text-xs opacity-70">
                            📎 {m.attachment.name} (file not available)
                          </p>
                        ))}
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <p className="text-center text-xs text-slate-400">
                  No messages yet — say hello
                </p>
              )}
            </div>

            <div className="border-t border-slate-100 p-3 sm:p-4">
              {pendingFile && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs">
                  <span className="truncate font-medium text-slate-700">
                    {pendingFile.name}
                  </span>
                  <span className="text-slate-400">
                    {formatSize(pendingFile.size)}
                  </span>
                  <button
                    type="button"
                    className="ml-auto text-slate-500 hover:text-slate-800"
                    onClick={() => {
                      setPendingFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
              {fileError && (
                <p className="mb-2 text-xs text-red-600">{fileError}</p>
              )}
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!body.trim() && !pendingFile) return;
                  sendMut.mutate({ text: body.trim(), att: pendingFile });
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept={ATTACHMENT_ACCEPT}
                  onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  title="Attach document"
                >
                  📎
                </button>
                <input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={
                    sendMut.isPending || (!body.trim() && !pendingFile)
                  }
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Send
                </button>
              </form>
              <p className="mt-1.5 text-[10px] text-slate-400">
                Attach a rider, invoice or contract: PDF, Word, Excel, text or image, up to 2 MB
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
