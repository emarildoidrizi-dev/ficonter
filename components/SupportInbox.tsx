"use client";

import {
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  ExternalLink,
  Inbox,
  LoaderCircle,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminSupportRequest } from "@/lib/admin/support";
import {
  supportCategoryLabel,
  supportReference,
  supportStatusLabel,
  type SupportStatus,
} from "@/lib/support";
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

function replyHref(request: AdminSupportRequest): string {
  const subject = encodeURIComponent(
    `FICONTER support · ${supportReference(request.id)} · ${request.subject}`,
  );
  return `mailto:${encodeURIComponent(request.contactEmail)}?subject=${subject}`;
}

export function SupportInbox({
  initialRequests,
}: {
  initialRequests: AdminSupportRequest[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState<"all" | SupportStatus>("all");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const counts = useMemo(
    () => ({
      all: requests.length,
      open: requests.filter((request) => request.status === "open").length,
      in_progress: requests.filter(
        (request) => request.status === "in_progress",
      ).length,
      resolved: requests.filter((request) => request.status === "resolved").length,
    }),
    [requests],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return requests.filter((request) => {
      if (filter !== "all" && request.status !== filter) return false;
      if (!normalized) return true;
      return [
        request.contactEmail,
        request.subject,
        request.message,
        supportReference(request.id),
        supportCategoryLabel(request.category),
      ].some((value) => value.toLowerCase().includes(normalized));
    });
  }, [filter, query, requests]);

  const refresh = useCallback(async (showError = true) => {
    setRefreshing(true);
    if (showError) setError("");

    try {
      const response = await fetch("/api/admin/support", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as {
        requests?: AdminSupportRequest[];
        error?: string;
      } | null;

      if (!response.ok || !data?.requests) {
        throw new Error(data?.error ?? "The support inbox could not be refreshed.");
      }

      setRequests(data.requests);
    } catch (refreshError) {
      if (showError) {
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : "The support inbox could not be refreshed.",
        );
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(false);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function updateStatus(
    supportRequest: AdminSupportRequest,
    status: SupportStatus,
  ) {
    if (updatingId) return;
    setUpdatingId(supportRequest.id);
    setError("");

    try {
      const response = await fetch(`/api/admin/support/${supportRequest.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json().catch(() => null)) as {
        request?: AdminSupportRequest;
        error?: string;
      } | null;

      if (!response.ok || !data?.request) {
        throw new Error(data?.error ?? "The support request could not be updated.");
      }

      const updatedRequest = data.request;
      setRequests((current) =>
        current.map((item) =>
          item.id === updatedRequest.id ? updatedRequest : item,
        ),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "The support request could not be updated.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>PRIVATE ADMINISTRATION</span>
          <h1>Support inbox</h1>
          <p>
            Review customer concerns and respond using the contact email they
            provided. Financial account values are never shown here.
          </p>
        </div>
        <div className={styles.secureBadge}>
          <ShieldCheck size={16} aria-hidden="true" />
          Admin protected
        </div>
      </header>

      <div className={styles.metrics}>
        <article>
          <Inbox size={19} aria-hidden="true" />
          <span>All requests</span>
          <strong>{counts.all}</strong>
        </article>
        <article>
          <CircleDot size={19} aria-hidden="true" />
          <span>Open</span>
          <strong>{counts.open}</strong>
        </article>
        <article>
          <Clock3 size={19} aria-hidden="true" />
          <span>In progress</span>
          <strong>{counts.in_progress}</strong>
        </article>
        <article>
          <CheckCircle2 size={19} aria-hidden="true" />
          <span>Resolved</span>
          <strong>{counts.resolved}</strong>
        </article>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters} aria-label="Support status filters">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={filter === item.value ? styles.filterActive : undefined}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
              <span>{counts[item.value]}</span>
            </button>
          ))}
        </div>
        <div className={styles.tools}>
          <label>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search email, subject or reference"
              aria-label="Search support requests"
            />
          </label>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void refresh(true)}
            disabled={refreshing}
            aria-label="Refresh support inbox"
            title="Refresh support inbox"
          >
            <RefreshCw
              size={17}
              className={refreshing ? styles.spinning : undefined}
            />
          </button>
        </div>
      </div>

      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}

      <div className={styles.requestList}>
        {filtered.map((supportRequest) => {
          const busy = updatingId === supportRequest.id;
          return (
            <details className={styles.requestCard} key={supportRequest.id}>
              <summary>
                <span className={`${styles.status} ${styles[supportRequest.status]}`}>
                  {supportStatusLabel(supportRequest.status)}
                </span>
                <span className={styles.summaryCopy}>
                  <strong>{supportRequest.subject}</strong>
                  <small>
                    {supportCategoryLabel(supportRequest.category)} · {supportReference(supportRequest.id)}
                  </small>
                </span>
                <span className={styles.summaryMeta}>
                  <strong>{supportRequest.contactEmail}</strong>
                  <small>{formatDateTime(supportRequest.createdAt)}</small>
                </span>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>

              <div className={styles.requestBody}>
                <div className={styles.messageBlock}>
                  <span>CUSTOMER CONCERN</span>
                  <p>{supportRequest.message}</p>
                </div>

                <dl className={styles.detailsGrid}>
                  <div>
                    <dt>Reply email</dt>
                    <dd>{supportRequest.contactEmail}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{formatDateTime(supportRequest.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Reference</dt>
                    <dd>{supportReference(supportRequest.id)}</dd>
                  </div>
                  <div>
                    <dt>Last updated</dt>
                    <dd>{formatDateTime(supportRequest.updatedAt)}</dd>
                  </div>
                </dl>

                <div className={styles.actions}>
                  <a href={replyHref(supportRequest)}>
                    <Mail size={16} aria-hidden="true" />
                    Reply by email
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>

                  {supportRequest.status !== "open" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateStatus(supportRequest, "open")}
                    >
                      {busy ? <LoaderCircle className={styles.spinning} size={16} /> : null}
                      Reopen
                    </button>
                  ) : null}

                  {supportRequest.status !== "in_progress" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void updateStatus(supportRequest, "in_progress")
                      }
                    >
                      {busy ? <LoaderCircle className={styles.spinning} size={16} /> : null}
                      Mark in progress
                    </button>
                  ) : null}

                  {supportRequest.status !== "resolved" ? (
                    <button
                      type="button"
                      className={styles.resolveButton}
                      disabled={busy}
                      onClick={() =>
                        void updateStatus(supportRequest, "resolved")
                      }
                    >
                      {busy ? <LoaderCircle className={styles.spinning} size={16} /> : <CheckCircle2 size={16} />}
                      Resolve
                    </button>
                  ) : null}
                </div>
              </div>
            </details>
          );
        })}

        {!filtered.length ? (
          <div className={styles.emptyState}>
            <Inbox size={25} aria-hidden="true" />
            <strong>No support requests found</strong>
            <p>
              New concerns submitted through Contact Us will appear here.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
