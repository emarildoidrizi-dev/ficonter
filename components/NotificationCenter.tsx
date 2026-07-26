"use client";

import { Bell, CheckCheck, Inbox, LoaderCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationItem } from "@/lib/supportMessaging";
import styles from "./NotificationCenter.module.css";

function formatRelative(value: string): string {
  const difference = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(difference / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationCenter({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminSupportUnread, setAdminSupportUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = (await response.json().catch(() => null)) as {
        notifications?: NotificationItem[];
        unreadCount?: number;
        adminSupportUnread?: number;
      } | null;
      if (!response.ok || !data?.notifications) return;
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount ?? 0);
      setAdminSupportUnread(data.adminSupportUnread ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      channel = supabase
        .channel(`ficonter-notifications-${data.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${data.user.id}`,
          },
          () => void refresh(),
        )
        .subscribe();
    });

    return () => {
      window.clearInterval(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh, supabase]);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  async function markRead(id?: string) {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    if (response.ok) {
      setNotifications((current) => current.map((item) => id && item.id !== id ? item : { ...item, readAt: item.readAt ?? new Date().toISOString() }));
      setUnreadCount(id ? Math.max(0, unreadCount - 1) : 0);
    }
  }

  function openNotification(item: NotificationItem) {
    if (!item.readAt) void markRead(item.id);
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  const inboxHref = isAdmin ? "/dashboard/admin/support" : "/dashboard/inbox";
  const inboxBadge = isAdmin ? adminSupportUnread : notifications.filter((item) => item.kind === "support_reply" && !item.readAt).length;

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={isAdmin ? "Open support inbox" : "Open messages"}
        title={isAdmin ? "Support inbox" : "Messages"}
        onClick={() => router.push(inboxHref)}
      >
        <Inbox size={18} aria-hidden="true" />
        {inboxBadge > 0 ? <span>{Math.min(inboxBadge, 99)}</span> : null}
      </button>

      <button
        type="button"
        className={styles.iconButton}
        aria-label="Open notifications"
        aria-expanded={open}
        title="Notifications"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 ? <span>{Math.min(unreadCount, 99)}</span> : null}
      </button>

      {open ? (
        <div className={styles.panel} role="dialog" aria-label="Notifications">
          <header>
            <div>
              <strong>Notifications</strong>
              <small>{unreadCount ? `${unreadCount} unread` : "You are all caught up"}</small>
            </div>
            {unreadCount > 0 ? (
              <button type="button" onClick={() => void markRead()}>
                <CheckCheck size={15} aria-hidden="true" />
                Mark all read
              </button>
            ) : null}
          </header>

          <div className={styles.list}>
            {loading ? (
              <div className={styles.empty}><LoaderCircle className={styles.spin} size={20} /> Loading notifications…</div>
            ) : notifications.length ? notifications.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`${styles.notification}${item.readAt ? "" : ` ${styles.unread}`}`}
                onClick={() => openNotification(item)}
              >
                <span className={styles.dot} aria-hidden="true" />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.body}</small>
                  <time>{formatRelative(item.createdAt)}</time>
                </span>
              </button>
            )) : (
              <div className={styles.empty}>
                <Bell size={21} aria-hidden="true" />
                <strong>No notifications yet</strong>
                <small>Support replies and important account updates will appear here.</small>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
