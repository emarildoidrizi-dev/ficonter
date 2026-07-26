"use client";

import {
  CheckCircle2,
  CircleDot,
  Clock3,
  Inbox,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { OPEN_CONTACT_EVENT, supportCategoryLabel, supportStatusLabel } from "@/lib/support";
import { SUPPORT_MESSAGE_LIMIT, type SupportThread } from "@/lib/supportMessaging";
import styles from "./SupportConversations.module.css";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function unreadAdminMessages(thread: SupportThread): number {
  const readAt = thread.customerLastReadAt ? new Date(thread.customerLastReadAt).getTime() : 0;
  return thread.messages.filter(
    (message) => message.senderRole === "admin" && new Date(message.createdAt).getTime() > readAt,
  ).length;
}

export function SupportConversations({
  initialThreads,
  initialSelectedId,
}: {
  initialThreads: SupportThread[];
  initialSelectedId?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const [threads, setThreads] = useState(initialThreads);
  const [selectedId, setSelectedId] = useState(
    initialSelectedId && initialThreads.some((item) => item.id === initialSelectedId)
      ? initialSelectedId
      : initialThreads[0]?.id ?? null,
  );
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const selected = threads.find((thread) => thread.id === selectedId) ?? null;
  const totalUnread = threads.reduce((sum, thread) => sum + unreadAdminMessages(thread), 0);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const response = await fetch("/api/support/threads", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = (await response.json().catch(() => null)) as { threads?: SupportThread[]; error?: string } | null;
      if (!response.ok || !data?.threads) throw new Error(data?.error ?? "Your inbox could not be refreshed.");
      setThreads(data.threads);
      setSelectedId((current) => current && data.threads?.some((thread) => thread.id === current) ? current : data.threads?.[0]?.id ?? null);
    } catch (refreshError) {
      if (!quiet) setError(refreshError instanceof Error ? refreshError.message : "Your inbox could not be refreshed.");
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 20_000);

    const channel = supabase
      .channel("ficonter-customer-support-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, () => void refresh(true))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_requests" }, () => void refresh(true))
      .subscribe();

    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [refresh, supabase]);

  useEffect(() => {
    if (!selectedId) return;
    const now = new Date().toISOString();
    setThreads((current) => current.map((thread) => thread.id === selectedId ? { ...thread, customerLastReadAt: now } : thread));
    void fetch(`/api/support/threads/${selectedId}/read`, {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    router.replace(`/dashboard/inbox?thread=${selectedId}`, { scroll: false });
    window.setTimeout(() => messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 60);
  }, [router, selectedId]);

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || sending) return;
    const body = reply.trim();
    if (!body) {
      setError("Write a message before sending.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/support/threads/${selected.id}/messages`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Your reply could not be sent.");
      setReply("");
      await refresh(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Your reply could not be sent.");
    } finally {
      setSending(false);
    }
  }

  function openContact() {
    window.dispatchEvent(new Event(OPEN_CONTACT_EVENT));
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>PRIVATE SUPPORT</span>
          <h1>Inbox</h1>
          <p>Exchange secure messages with the FICONTER support team and follow every concern in one place.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => void refresh(false)} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? styles.spinning : undefined} />
            Refresh
          </button>
          <button type="button" className={styles.primaryButton} onClick={openContact}>
            <MessageSquareText size={16} /> New concern
          </button>
        </div>
      </header>

      <div className={styles.metrics}>
        <article><Inbox size={18} /><span>Conversations</span><strong>{threads.length}</strong></article>
        <article><CircleDot size={18} /><span>Open</span><strong>{threads.filter((item) => item.status === "open").length}</strong></article>
        <article><Clock3 size={18} /><span>In progress</span><strong>{threads.filter((item) => item.status === "in_progress").length}</strong></article>
        <article><CheckCircle2 size={18} /><span>Unread replies</span><strong>{totalUnread}</strong></article>
      </div>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}

      <div className={styles.workspace}>
        <aside className={styles.threadList} aria-label="Support conversations">
          {threads.map((thread) => {
            const unread = unreadAdminMessages(thread);
            const latest = thread.messages.at(-1);
            return (
              <button
                type="button"
                key={thread.id}
                className={`${styles.threadButton}${selectedId === thread.id ? ` ${styles.threadActive}` : ""}`}
                onClick={() => setSelectedId(thread.id)}
              >
                <span className={styles.threadTop}>
                  <strong>{thread.subject}</strong>
                  {unread ? <b>{unread}</b> : null}
                </span>
                <span>{thread.reference} · {supportStatusLabel(thread.status)}</span>
                <small>{latest?.body ?? "No messages yet"}</small>
                <time>{formatDateTime(thread.lastMessageAt)}</time>
              </button>
            );
          })}
          {!threads.length ? (
            <div className={styles.emptyList}>
              <Inbox size={25} />
              <strong>No support conversations</strong>
              <p>Start a concern and every reply will remain available here.</p>
              <button type="button" onClick={openContact}>Contact Us</button>
            </div>
          ) : null}
        </aside>

        <div className={styles.conversation}>
          {selected ? (
            <>
              <header className={styles.conversationHeader}>
                <div>
                  <span>{supportCategoryLabel(selected.category)} · {selected.reference}</span>
                  <h2>{selected.subject}</h2>
                </div>
                <span className={`${styles.status} ${styles[`status_${selected.status}`]}`}>{supportStatusLabel(selected.status)}</span>
              </header>

              <div className={styles.messages} aria-live="polite">
                {selected.messages.map((message) => (
                  <article key={message.id} className={`${styles.message} ${message.senderRole === "customer" ? styles.customerMessage : styles.adminMessage}`}>
                    <div>
                      <strong>{message.senderRole === "customer" ? "You" : "FICONTER Support"}</strong>
                      <time>{formatDateTime(message.createdAt)}</time>
                    </div>
                    <p>{message.body}</p>
                  </article>
                ))}
                <div ref={messageEndRef} />
              </div>

              <form className={styles.composer} onSubmit={sendReply}>
                {selected.status === "resolved" ? <p className={styles.reopenNote}>Sending a new message will reopen this concern.</p> : null}
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Write a reply to FICONTER Support…"
                  maxLength={SUPPORT_MESSAGE_LIMIT}
                  rows={4}
                  required
                />
                <div>
                  <small>{reply.length.toLocaleString("en-US")}/{SUPPORT_MESSAGE_LIMIT.toLocaleString("en-US")}</small>
                  <button type="submit" disabled={sending || !reply.trim()}>
                    {sending ? <LoaderCircle className={styles.spinning} size={16} /> : <Send size={16} />}
                    {sending ? "Sending…" : "Send message"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className={styles.emptyConversation}>
              <MessageSquareText size={30} />
              <strong>Select a conversation</strong>
              <p>Your private message history with the support team will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
