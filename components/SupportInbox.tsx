"use client";

import {
  CheckCircle2,
  CircleDot,
  Clock3,
  Inbox,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Search,
  Save,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { AdminSupportRequest } from "@/lib/admin/support";
import { supportCategoryLabel, supportStatusLabel, type SupportStatus } from "@/lib/support";
import {
  SUPPORT_MESSAGE_LIMIT,
  SUPPORT_READ_EVENT,
  type SupportReadEventDetail,
} from "@/lib/supportMessaging";
import { SupportDeleteDialog } from "./SupportDeleteDialog";
import styles from "./SupportInbox.module.css";

const FILTERS: Array<{ value: "all" | SupportStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

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

export function SupportInbox({ initialRequests }: { initialRequests: AdminSupportRequest[] }) {
  const messageEndRef = useRef<HTMLDivElement>(null);
  const [requests, setRequests] = useState(initialRequests);
  const [selectedId, setSelectedId] = useState<string | null>(initialRequests[0]?.id ?? null);
  const [filter, setFilter] = useState<"all" | SupportStatus>("all");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusDraft, setStatusDraft] = useState<SupportStatus>(initialRequests[0]?.status ?? "open");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminSupportRequest | null>(null);
  const [deleting, setDeleting] = useState(false);

  const counts = useMemo(() => ({
    all: requests.length,
    open: requests.filter((item) => item.status === "open").length,
    in_progress: requests.filter((item) => item.status === "in_progress").length,
    resolved: requests.filter((item) => item.status === "resolved").length,
  }), [requests]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return requests.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false;
      if (!normalized) return true;
      return [item.contactEmail, item.subject, item.reference, supportCategoryLabel(item.category)]
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [filter, query, requests]);

  const selected = requests.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) setStatusDraft(selected.status);
  }, [selected?.id, selected?.status]);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const response = await fetch("/api/admin/support", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
      const data = (await response.json().catch(() => null)) as { requests?: AdminSupportRequest[]; error?: string } | null;
      if (!response.ok || !data?.requests) throw new Error(data?.error ?? "The support inbox could not be refreshed.");
      const refreshedRequests: AdminSupportRequest[] = data.requests;
      setRequests(refreshedRequests);
      setSelectedId((current) =>
        current !== null && refreshedRequests.some((item) => item.id === current)
          ? current
          : refreshedRequests[0]?.id ?? null,
      );
    } catch (refreshError) {
      if (!quiet) setError(refreshError instanceof Error ? refreshError.message : "The support inbox could not be refreshed.");
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) return;
    const activeRequest = requests.find((item) => item.id === selectedId);
    const clearedCount = activeRequest?.unreadCustomerMessages ?? 0;
    const now = new Date().toISOString();

    setRequests((current) => current.map((item) =>
      item.id === selectedId ? { ...item, unreadCustomerMessages: 0, adminLastReadAt: now } : item,
    ));

    window.dispatchEvent(new CustomEvent<SupportReadEventDetail>(SUPPORT_READ_EVENT, {
      detail: { audience: "admin", requestId: selectedId, clearedCount },
    }));

    void fetch(`/api/admin/support/${selectedId}/read`, {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }).then((response) => {
      if (!response.ok) void refresh(true);
    }).catch(() => void refresh(true));

    window.setTimeout(() => messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 60);
  }, [refresh, selected?.lastMessageAt, selectedId]);

  async function updateStatus(status: SupportStatus) {
    if (!selected || updating) return;
    setUpdating(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/support/${selected.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json().catch(() => null)) as { request?: AdminSupportRequest; error?: string } | null;
      if (!response.ok || !data?.request) throw new Error(data?.error ?? "The support request could not be updated.");
      const updatedRequest: AdminSupportRequest = data.request;
      setRequests((current) => current.map((item) => item.id === updatedRequest.id ? updatedRequest : item));
      setStatusDraft(updatedRequest.status);
    } catch (updateError) {
      setStatusDraft(selected.status);
      setError(updateError instanceof Error ? updateError.message : "The support request could not be updated.");
    } finally {
      setUpdating(false);
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || updating || !reply.trim()) return;
    setUpdating(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/support/${selected.id}/messages`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ body: reply.trim(), internalNote }),
      });
      const data = (await response.json().catch(() => null)) as { request?: AdminSupportRequest; error?: string } | null;
      if (!response.ok || !data?.request) throw new Error(data?.error ?? "The reply could not be sent.");
      const updatedRequest: AdminSupportRequest = data.request;
      setRequests((current) => current.map((item) => item.id === updatedRequest.id ? updatedRequest : item));
      setReply("");
      setInternalNote(false);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "The reply could not be sent.");
    } finally {
      setUpdating(false);
    }
  }

  async function deleteConversation() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/support/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const data = (await response.json().catch(() => null)) as { deletedId?: string; error?: string } | null;
      if (!response.ok || data?.deletedId !== deleteTarget.id) {
        throw new Error(data?.error ?? "The support conversation could not be deleted.");
      }

      const remaining = requests.filter((item) => item.id !== deleteTarget.id);
      setRequests(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setDeleteTarget(null);
      setReply("");
      setInternalNote(false);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The support conversation could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>PRIVATE ADMINISTRATION</span>
          <h1>Support inbox</h1>
          <p>Reply directly inside FICONTER. Customer financial values and uploaded documents are never displayed here.</p>
        </div>
        <div className={styles.secureBadge}><ShieldCheck size={16} /> Admin protected</div>
      </header>

      <div className={styles.metrics}>
        <article><Inbox size={19} /><span>All requests</span><strong>{counts.all}</strong></article>
        <article><CircleDot size={19} /><span>Open</span><strong>{counts.open}</strong></article>
        <article><Clock3 size={19} /><span>In progress</span><strong>{counts.in_progress}</strong></article>
        <article><CheckCircle2 size={19} /><span>Resolved</span><strong>{counts.resolved}</strong></article>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {FILTERS.map((item) => (
            <button type="button" key={item.value} className={filter === item.value ? styles.filterActive : undefined} onClick={() => setFilter(item.value)}>
              {item.label}<span>{counts[item.value]}</span>
            </button>
          ))}
        </div>
        <div className={styles.tools}>
          <label><Search size={16} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search email, subject or reference" /></label>
          <button type="button" onClick={() => void refresh(false)} disabled={refreshing} aria-label="Refresh support inbox"><RefreshCw size={17} className={refreshing ? styles.spinning : undefined} /></button>
        </div>
      </div>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}

      <div className={styles.workspace}>
        <aside className={`${styles.requestList} ficonter-scroll-region`}>
          {filtered.map((item) => (
            <button type="button" key={item.id} className={`${styles.requestItem}${selectedId === item.id ? ` ${styles.requestActive}` : ""}`} onClick={() => setSelectedId(item.id)}>
              <span className={styles.requestTop}><strong>{item.subject}</strong>{item.unreadCustomerMessages ? <b>{item.unreadCustomerMessages}</b> : null}</span>
              <span>{item.reference} · {supportStatusLabel(item.status)}</span>
              <small>{item.contactEmail}</small>
              <time>{formatDateTime(item.lastMessageAt)}</time>
            </button>
          ))}
          {!filtered.length ? <div className={styles.emptyList}><Inbox size={24} /><strong>No requests found</strong><p>New customer concerns will appear here.</p></div> : null}
        </aside>

        <div className={styles.conversation}>
          {selected ? (
            <>
              <header className={styles.conversationHeader}>
                <div>
                  <span>{supportCategoryLabel(selected.category)} · {selected.reference}</span>
                  <h2>{selected.subject}</h2>
                  <small>{selected.contactEmail}</small>
                </div>
                <div className={styles.conversationActions}>
                  <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as SupportStatus)} disabled={updating || deleting} aria-label="Support status">
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <button
                    type="button"
                    className={styles.saveStatusButton}
                    disabled={updating || deleting || statusDraft === selected.status}
                    onClick={() => void updateStatus(statusDraft)}
                  >
                    <Save size={14} aria-hidden="true" />
                    {updating ? "Saving…" : "Save status"}
                  </button>
                  <button
                    type="button"
                    className={styles.deleteThreadButton}
                    onClick={() => setDeleteTarget(selected)}
                    disabled={updating || deleting}
                    aria-label={`Delete ${selected.reference}`}
                    title="Delete conversation"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </header>

              <div className={`${styles.messages} ficonter-scroll-region`}>
                {selected.messages.map((message) => (
                  <article key={message.id} className={`${styles.message} ${message.senderRole === "admin" ? styles.adminMessage : styles.customerMessage}${message.internalNote ? ` ${styles.internalMessage}` : ""}`}>
                    <div>
                      <strong>{message.internalNote ? "Internal admin note" : message.senderRole === "admin" ? "FICONTER Support" : "Customer"}</strong>
                      <time>{formatDateTime(message.createdAt)}</time>
                    </div>
                    <p>{message.body}</p>
                  </article>
                ))}
                <div ref={messageEndRef} />
              </div>

              <form className={styles.composer} onSubmit={sendReply}>
                <div className={styles.composerMode}>
                  <label><input type="checkbox" checked={internalNote} onChange={(event) => setInternalNote(event.target.checked)} /> Internal note — hidden from customer</label>
                  <small>{reply.length.toLocaleString("en-US")}/{SUPPORT_MESSAGE_LIMIT.toLocaleString("en-US")}</small>
                </div>
                <textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={SUPPORT_MESSAGE_LIMIT} rows={4} placeholder={internalNote ? "Write an internal note…" : "Write a reply to the customer…"} required />
                <div className={styles.composerActions}>
                  <span>{internalNote ? "This note stays private to administrators." : "The customer will receive an in-app notification."}</span>
                  <button type="submit" disabled={updating || !reply.trim()}>
                    {updating ? <LoaderCircle className={styles.spinning} size={16} /> : <Send size={16} />}
                    {internalNote ? "Save note" : "Send reply"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className={styles.emptyConversation}><MessageSquareText size={30} /><strong>Select a support request</strong><p>The full conversation will appear here.</p></div>
          )}
        </div>
      </div>

      <SupportDeleteDialog
        open={Boolean(deleteTarget)}
        reference={deleteTarget?.reference ?? ""}
        subject={deleteTarget?.subject ?? ""}
        audience="admin"
        busy={deleting}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={() => void deleteConversation()}
      />
    </section>
  );
}
