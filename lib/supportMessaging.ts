import type { SupportCategory, SupportStatus } from "@/lib/support";

export const SUPPORT_MESSAGE_LIMIT = 5000;

export const SUPPORT_READ_EVENT = "ficonter:support-read";

export type SupportReadEventDetail = {
  audience: "customer" | "admin";
  requestId: string;
  clearedCount: number;
};

export type SupportMessage = {
  id: string;
  requestId: string;
  senderRole: "customer" | "admin";
  body: string;
  internalNote: boolean;
  createdAt: string;
};

export type SupportThread = {
  id: string;
  contactEmail: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  reference: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  customerLastReadAt: string | null;
  adminLastReadAt: string | null;
  messages: SupportMessage[];
};

export type NotificationItem = {
  id: string;
  kind:
    | "support_reply"
    | "support_status"
    | "document_uploaded"
    | "document_deleted"
    | "system";
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function validateSupportMessage(value: unknown):
  | { ok: true; body: string }
  | { ok: false; error: string } {
  const body = typeof value === "string" ? value.trim() : "";
  if (!body) return { ok: false, error: "Write a message before sending." };
  if (body.length > SUPPORT_MESSAGE_LIMIT) {
    return {
      ok: false,
      error: `Messages cannot exceed ${SUPPORT_MESSAGE_LIMIT.toLocaleString("en-US")} characters.`,
    };
  }
  return { ok: true, body };
}
