export const OPEN_CONTACT_EVENT = "ficonter:open-contact-us";

export const SUPPORT_CATEGORIES = [
  { value: "technical_issue", label: "Technical issue" },
  { value: "account_access", label: "Account access" },
  { value: "privacy_data", label: "Privacy or data" },
  { value: "feature_request", label: "Feature request" },
  { value: "billing_subscription", label: "Billing or subscription" },
  { value: "other", label: "Other concern" },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["value"];
export type SupportStatus = "open" | "in_progress" | "resolved";

export type SupportRequestInput = {
  email: string;
  category: SupportCategory;
  subject: string;
  message: string;
};

export const SUPPORT_LIMITS = {
  email: 254,
  subjectMin: 3,
  subjectMax: 120,
  messageMin: 20,
  messageMax: 5000,
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isSupportCategory(value: unknown): value is SupportCategory {
  return SUPPORT_CATEGORIES.some((category) => category.value === value);
}

export function isSupportStatus(value: unknown): value is SupportStatus {
  return value === "open" || value === "in_progress" || value === "resolved";
}

export function supportCategoryLabel(category: SupportCategory): string {
  return (
    SUPPORT_CATEGORIES.find((option) => option.value === category)?.label ??
    "Other concern"
  );
}

export function supportStatusLabel(status: SupportStatus): string {
  if (status === "in_progress") return "In progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function supportReference(id: string): string {
  return `FIC-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export function validateSupportRequestInput(
  value: unknown,
):
  | { ok: true; data: SupportRequestInput }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Enter your contact details and concern." };
  }

  const payload = value as Record<string, unknown>;
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const subject =
    typeof payload.subject === "string" ? payload.subject.trim() : "";
  const message =
    typeof payload.message === "string" ? payload.message.trim() : "";
  const category = payload.category;

  if (!email || email.length > SUPPORT_LIMITS.email || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  if (!isSupportCategory(category)) {
    return { ok: false, error: "Select the concern category." };
  }

  if (
    subject.length < SUPPORT_LIMITS.subjectMin ||
    subject.length > SUPPORT_LIMITS.subjectMax
  ) {
    return {
      ok: false,
      error: `The subject must contain ${SUPPORT_LIMITS.subjectMin}–${SUPPORT_LIMITS.subjectMax} characters.`,
    };
  }

  if (
    message.length < SUPPORT_LIMITS.messageMin ||
    message.length > SUPPORT_LIMITS.messageMax
  ) {
    return {
      ok: false,
      error: `The message must contain ${SUPPORT_LIMITS.messageMin}–${SUPPORT_LIMITS.messageMax.toLocaleString("en-US")} characters.`,
    };
  }

  return {
    ok: true,
    data: {
      email: email.toLowerCase(),
      category,
      subject,
      message,
    },
  };
}
