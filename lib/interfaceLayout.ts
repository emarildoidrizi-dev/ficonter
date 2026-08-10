export const INTERFACE_LAYOUT_VALUES = [
  "classic",
  "horizon",
  "executive",
  "rail",
  "bento",
  "floating",
  "top-context",
  "adaptive",
  "horizontal",
  "card-stack",
  "split-analytics",
] as const;

export type InterfaceLayoutPreference = (typeof INTERFACE_LAYOUT_VALUES)[number];

export function normalizeInterfaceLayout(
  value: string | null | undefined,
): InterfaceLayoutPreference {
  return INTERFACE_LAYOUT_VALUES.includes(value as InterfaceLayoutPreference)
    ? (value as InterfaceLayoutPreference)
    : "horizon";
}
