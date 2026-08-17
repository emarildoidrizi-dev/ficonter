"use client";

import { useEffect, useRef } from "react";
import {
  clearFiconterNavigationState,
  isFiconterNavigationPending,
  navigationIntentAgeMs,
} from "@/lib/navigationRuntime";

const CHUNK_RECOVERY_KEY = "ficonter:chunk-recovery";
const CHUNK_RECOVERY_WINDOW_MS = 60_000;
const STALE_NAVIGATION_MS = 12_000;

function errorText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value && typeof value === "object") {
    const candidate = value as { message?: unknown; reason?: unknown };
    if (typeof candidate.message === "string") return candidate.message;
    if (candidate.reason) return errorText(candidate.reason);
  }
  return "";
}

function isRecoverableChunkFailure(value: unknown): boolean {
  const text = errorText(value).toLowerCase();
  if (!text) return false;

  return [
    "chunkloaderror",
    "loading chunk",
    "failed to fetch dynamically imported module",
    "importing a module script failed",
    "error loading dynamically imported module",
    "failed to load module script",
  ].some((needle) => text.includes(needle));
}

function recentlyRecoveredHere(): boolean {
  try {
    const stored = sessionStorage.getItem(CHUNK_RECOVERY_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored) as { href?: string; at?: number };
    return (
      parsed.href === window.location.href &&
      typeof parsed.at === "number" &&
      Date.now() - parsed.at < CHUNK_RECOVERY_WINDOW_MS
    );
  } catch {
    return false;
  }
}

function markRecoveryAttempt(): void {
  try {
    sessionStorage.setItem(
      CHUNK_RECOVERY_KEY,
      JSON.stringify({ href: window.location.href, at: Date.now() }),
    );
  } catch {
    // Session storage is an optimization only.
  }
}

/**
 * Workspace-level recovery for the small class of failures that can otherwise
 * leave an SPA/PWA looking frozen after a deployment, bfcache restore, or
 * interrupted network transition.
 *
 * Normal routing never reloads the page. A hard reload is reserved for a
 * detected stale/dynamic chunk failure and is attempted at most once per URL
 * within a short recovery window.
 */
export function RuntimeStabilityBridge() {
  const recoveringRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;

    const syncNetworkState = () => {
      root.dataset.ficonterNetwork = navigator.onLine ? "online" : "offline";
    };

    const clearStaleNavigation = () => {
      if (!isFiconterNavigationPending()) return;
      if (navigationIntentAgeMs() < STALE_NAVIGATION_MS) return;
      clearFiconterNavigationState();
    };

    const recoverChunkFailure = (value: unknown) => {
      if (recoveringRef.current || !navigator.onLine) return;
      if (!isRecoverableChunkFailure(value)) return;
      if (recentlyRecoveredHere()) return;

      recoveringRef.current = true;
      markRecoveryAttempt();
      clearFiconterNavigationState();

      window.setTimeout(() => {
        window.location.reload();
      }, 120);
    };

    const onError = (event: ErrorEvent) => {
      recoverChunkFailure(event.error ?? event.message);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      recoverChunkFailure(event.reason);
    };

    const onPageShow = (event: PageTransitionEvent) => {
      syncNetworkState();
      if (event.persisted) clearFiconterNavigationState();
      else clearStaleNavigation();
    };

    const onPopState = () => {
      // Browser Back/Forward can restore a page without a fresh navigation
      // intent. Never let an old pending flag keep the workspace "busy".
      window.requestAnimationFrame(clearStaleNavigation);
    };

    const onOnline = () => {
      syncNetworkState();
      clearStaleNavigation();
    };

    const onOffline = () => {
      syncNetworkState();
      // Offline navigation cannot settle through the App Router. Clearing the
      // progress state keeps the current screen usable until connectivity
      // returns; the service worker still owns the offline fallback.
      clearFiconterNavigationState();
    };

    syncNetworkState();
    clearStaleNavigation();

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      root.removeAttribute("data-ficonter-network");
    };
  }, []);

  return null;
}
