export const INTERFACE_LAYOUT_VALUES = ["classic", "horizon"] as const;

export type InterfaceLayoutPreference = (typeof INTERFACE_LAYOUT_VALUES)[number];

export function normalizeInterfaceLayout(
  value: string | null | undefined,
): InterfaceLayoutPreference {
  return value === "classic" ? "classic" : "horizon";
}
