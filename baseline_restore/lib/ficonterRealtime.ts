"use client";

export type FiconterDataScope =
  | "transactions"
  | "bills"
  | "debts"
  | "goals"
  | "savings"
  | "planner"
  | "net-worth"
  | "settings"
  | "profile"
  | "overview"
  | "all";

export type FiconterDataChange = {
  scope: FiconterDataScope;
  at: number;
  nonce: string;
};

export type FiconterDataChangeListener = (
  change: FiconterDataChange,
) => void;

const STORAGE_KEY = "ficonter:data-change";
const CHANNEL_NAME = "ficonter-platform-sync";
const DATA_SCOPE_SET = new Set<FiconterDataScope>([
  "transactions",
  "bills",
  "debts",
  "goals",
  "savings",
  "planner",
  "net-worth",
  "profile",
  "settings",
  "overview",
  "all",
]);

const listeners = new Set<FiconterDataChangeListener>();
const deliveredNonces = new Set<string>();
let sharedChannel: BroadcastChannel | null | undefined;
let bridgeCleanup: (() => void) | null = null;
let fallbackNonce = 0;

function createNonce(): string {
  try {
    return crypto.randomUUID();
  } catch {
    fallbackNonce += 1;
    return `${Date.now().toString(36)}-${fallbackNonce.toString(36)}`;
  }
}

function getChannel(): BroadcastChannel | null {
  if (sharedChannel !== undefined) return sharedChannel;

  try {
    sharedChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    sharedChannel = null;
  }

  return sharedChannel;
}

function rememberNonce(nonce: string): boolean {
  if (deliveredNonces.has(nonce)) return false;

  deliveredNonces.add(nonce);
  if (deliveredNonces.size > 300) {
    const oldest = deliveredNonces.values().next().value as
      | string
      | undefined;
    if (oldest) deliveredNonces.delete(oldest);
  }

  return true;
}

function deliver(value: unknown): void {
  const change = parseFiconterDataChange(value);
  if (!change || !rememberNonce(change.nonce)) return;

  listeners.forEach((listener) => {
    try {
      listener(change);
    } catch (error) {
      console.error("FICONTER live synchronization listener failed", error);
    }
  });
}

function ensureBridge(): void {
  if (typeof window === "undefined" || bridgeCleanup) return;

  const handleWindowEvent = (event: Event) => {
    deliver((event as CustomEvent<unknown>).detail);
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;

    try {
      deliver(JSON.parse(event.newValue));
    } catch {
      // Ignore malformed storage events.
    }
  };
  const handleBroadcast = (event: MessageEvent<unknown>) => {
    deliver(event.data);
  };

  window.addEventListener("ficonter:data-changed", handleWindowEvent);
  window.addEventListener("storage", handleStorage);
  getChannel()?.addEventListener("message", handleBroadcast);

  bridgeCleanup = () => {
    window.removeEventListener("ficonter:data-changed", handleWindowEvent);
    window.removeEventListener("storage", handleStorage);
    getChannel()?.removeEventListener("message", handleBroadcast);
    bridgeCleanup = null;
  };
}

export function notifyFiconterDataChange(
  scope: FiconterDataScope = "all",
): FiconterDataChange | null {
  if (typeof window === "undefined") return null;

  const detail: FiconterDataChange = {
    scope,
    at: Date.now(),
    nonce: createNonce(),
  };

  window.dispatchEvent(new CustomEvent("ficonter:data-changed", { detail }));

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(detail));
  } catch {
    // Storage may be blocked in strict privacy modes.
  }

  try {
    getChannel()?.postMessage(detail);
  } catch {
    // BroadcastChannel is optional; Supabase Realtime remains active.
  }

  return detail;
}

export function parseFiconterDataChange(
  value: unknown,
): FiconterDataChange | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<FiconterDataChange>;
  if (
    typeof candidate.scope !== "string" ||
    !DATA_SCOPE_SET.has(candidate.scope as FiconterDataScope) ||
    typeof candidate.at !== "number" ||
    typeof candidate.nonce !== "string"
  ) {
    return null;
  }

  return candidate as FiconterDataChange;
}

export function subscribeFiconterDataChanges(
  listener: FiconterDataChangeListener,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  ensureBridge();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) bridgeCleanup?.();
  };
}

export function isFinancialDataScope(
  scope: FiconterDataScope,
): boolean {
  return scope !== "profile" && scope !== "settings";
}

export const ficonterRealtimeKeys = {
  storage: STORAGE_KEY,
  channel: CHANNEL_NAME,
} as const;
