"use client";

export type FiconterDataScope =
  | "transactions"
  | "bills"
  | "debts"
  | "goals"
  | "planner"
  | "net-worth"
  | "settings"
  | "profile"
  | "overview"
  | "all";

const STORAGE_KEY = "ficonter:data-change";
const CHANNEL_NAME = "ficonter-platform-sync";

export function notifyFiconterDataChange(scope: FiconterDataScope = "all") {
  if (typeof window === "undefined") return;

  const detail = { scope, at: Date.now(), nonce: crypto.randomUUID() };
  window.dispatchEvent(new CustomEvent("ficonter:data-changed", { detail }));

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(detail));
  } catch {
    // Storage may be blocked in strict privacy modes.
  }

  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(detail);
    channel.close();
  } catch {
    // BroadcastChannel is optional; Supabase Realtime remains active.
  }
}

export const ficonterRealtimeKeys = {
  storage: STORAGE_KEY,
  channel: CHANNEL_NAME,
} as const;
