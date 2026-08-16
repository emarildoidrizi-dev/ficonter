"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  FICONTER_NAVIGATION_SETTLED_EVENT,
  isFiconterNavigationPending,
} from "@/lib/navigationRuntime";
import {
  ficonterRealtimeKeys,
  parseFiconterDataChange,
  type FiconterDataChange,
  type FiconterDataScope,
} from "@/lib/ficonterRealtime";

const REFRESH_DEBOUNCE_MS = 180;
const MIN_REFRESH_INTERVAL_MS = 650;
const PASSIVE_STALE_AFTER_MS = 60_000;
const MAX_REMEMBERED_NONCES = 160;

function scopesForPath(pathname: string): Set<FiconterDataScope> {
  if (pathname === "/dashboard") {
    return new Set([
      "transactions",
      "bills",
      "debts",
      "goals",
      "savings",
      "planner",
      "net-worth",
      "overview",
      "profile",
      "all",
    ]);
  }
  if (pathname.startsWith("/dashboard/transactions")) {
    return new Set(["transactions", "bills", "debts", "goals", "savings", "all"]);
  }
  if (pathname.startsWith("/dashboard/bills")) {
    return new Set(["bills", "transactions", "savings", "all"]);
  }
  if (pathname.startsWith("/dashboard/debt")) {
    return new Set(["debts", "transactions", "savings", "all"]);
  }
  if (pathname.startsWith("/dashboard/goals")) {
    return new Set(["goals", "transactions", "savings", "all"]);
  }
  if (pathname.startsWith("/dashboard/budget")) {
    return new Set([
      "planner",
      "transactions",
      "bills",
      "debts",
      "goals",
      "savings",
      "all",
    ]);
  }
  if (
    pathname.startsWith("/dashboard/cash-flow") ||
    pathname.startsWith("/dashboard/emergency-fund") ||
    pathname.startsWith("/dashboard/savings") ||
    pathname.startsWith("/dashboard/net-worth") ||
    pathname.startsWith("/dashboard/financial-independence") ||
    pathname.startsWith("/dashboard/insights") ||
    pathname.startsWith("/dashboard/gps")
  ) {
    return new Set([
      "transactions",
      "bills",
      "debts",
      "goals",
      "savings",
      "planner",
      "net-worth",
      "overview",
      "all",
    ]);
  }
  if (pathname.startsWith("/dashboard/settings")) {
    return new Set(["settings", "profile", "all"]);
  }
  return new Set(["all"]);
}

export function RealtimeRefreshBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const timerRef = useRef<number | null>(null);
  const lastRefreshRef = useRef(Date.now());
  const pendingWhileHiddenRef = useRef(false);
  const pendingWhileNavigatingRef = useRef(false);
  const rememberedNoncesRef = useRef<string[]>([]);
  const rememberedNonceSetRef = useRef(new Set<string>());

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    function rememberNonce(nonce: string): boolean {
      if (rememberedNonceSetRef.current.has(nonce)) return false;
      rememberedNonceSetRef.current.add(nonce);
      rememberedNoncesRef.current.push(nonce);
      while (rememberedNoncesRef.current.length > MAX_REMEMBERED_NONCES) {
        const removed = rememberedNoncesRef.current.shift();
        if (removed) rememberedNonceSetRef.current.delete(removed);
      }
      return true;
    }

    function isRelevant(change: FiconterDataChange | null): boolean {
      if (!change) return true;
      return scopesForPath(pathnameRef.current).has(change.scope);
    }

    function refreshSoon(change: FiconterDataChange | null = null) {
      if (change && !rememberNonce(change.nonce)) return;
      if (!isRelevant(change)) return;

      if (document.visibilityState !== "visible") {
        pendingWhileHiddenRef.current = true;
        return;
      }

      // Route changes always win over passive data refreshes. A refresh racing
      // an App Router transition can force the current RSC tree to reconcile
      // while the destination is also loading, which is both slower and less
      // deterministic. The destination already fetches current server data.
      if (isFiconterNavigationPending()) {
        pendingWhileNavigatingRef.current = true;
        return;
      }

      if (timerRef.current) window.clearTimeout(timerRef.current);
      const elapsed = Date.now() - lastRefreshRef.current;
      const delay = Math.max(
        REFRESH_DEBOUNCE_MS,
        MIN_REFRESH_INTERVAL_MS - elapsed,
      );

      timerRef.current = window.setTimeout(() => {
        if (isFiconterNavigationPending()) {
          pendingWhileNavigatingRef.current = true;
          timerRef.current = null;
          return;
        }

        router.refresh();
        lastRefreshRef.current = Date.now();
        pendingWhileHiddenRef.current = false;
        pendingWhileNavigatingRef.current = false;
        timerRef.current = null;
      }, delay);
    }

    function onCustomEvent(event: Event) {
      refreshSoon(
        parseFiconterDataChange(
          (event as CustomEvent<FiconterDataChange>).detail,
        ),
      );
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== ficonterRealtimeKeys.storage || !event.newValue) return;
      try {
        refreshSoon(parseFiconterDataChange(JSON.parse(event.newValue)));
      } catch {
        refreshSoon();
      }
    }

    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      if (
        pendingWhileHiddenRef.current ||
        Date.now() - lastRefreshRef.current > PASSIVE_STALE_AFTER_MS
      ) {
        refreshSoon();
      }
    }

    function onFocus() {
      if (Date.now() - lastRefreshRef.current > PASSIVE_STALE_AFTER_MS) {
        refreshSoon();
      }
    }

    function onChannelMessage(event: MessageEvent) {
      refreshSoon(parseFiconterDataChange(event.data));
    }

    function onNavigationSettled() {
      if (!pendingWhileNavigatingRef.current) return;
      pendingWhileNavigatingRef.current = false;

      // Let the destination route commit its pathname before deciding whether
      // a queued realtime refresh is relevant to the newly visible screen.
      window.requestAnimationFrame(() => refreshSoon());
    }

    window.addEventListener("ficonter:data-changed", onCustomEvent);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener(FICONTER_NAVIGATION_SETTLED_EVENT, onNavigationSettled);
    document.addEventListener("visibilitychange", onVisibility);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(ficonterRealtimeKeys.channel);
      channel.addEventListener("message", onChannelMessage);
    } catch {
      channel = null;
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.removeEventListener("ficonter:data-changed", onCustomEvent);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(FICONTER_NAVIGATION_SETTLED_EVENT, onNavigationSettled);
      document.removeEventListener("visibilitychange", onVisibility);
      channel?.removeEventListener("message", onChannelMessage);
      channel?.close();
    };
  }, [router]);

  return null;
}
