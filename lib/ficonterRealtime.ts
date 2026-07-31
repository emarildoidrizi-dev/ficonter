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
let sharedChannel: BroadcastChannel | null | undefined;
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

export const ficonterRealtimeKeys = {
  storage: STORAGE_KEY,
  channel: CHANNEL_NAME,
} as const;
