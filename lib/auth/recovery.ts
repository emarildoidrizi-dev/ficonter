export type AuthEntry = "app" | "brand";

export function normalizeAuthEntry(value: unknown): AuthEntry | null {
  return value === "app" || value === "brand" ? value : null;
}

export function withAuthEntry(path: string, entry: AuthEntry | null): string {
  if (!entry) return path;

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}entry=${encodeURIComponent(entry)}`;
}

export function recoveryErrorMessage(code: string | null | undefined): string | null {
  if (code === "expired_link") {
    return "That recovery link has expired or was already used. Request a new secure link below.";
  }

  if (code === "invalid_link") {
    return "That recovery link is invalid. Request a new secure link below.";
  }

  return null;
}
