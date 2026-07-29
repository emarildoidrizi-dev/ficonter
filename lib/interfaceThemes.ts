export const APPEARANCE_VALUES = [
  "light",
  "dark",
  "system",
  "midnight",
  "emerald",
  "bordeaux",
  "ocean",
  "sandstone",
] as const;

export type AppearancePreference = (typeof APPEARANCE_VALUES)[number];
export type ResolvedTheme = "light" | "dark";

export const DARK_APPEARANCE_VALUES: AppearancePreference[] = [
  "dark",
  "midnight",
  "emerald",
  "bordeaux",
];

export const INTERFACE_THEME_OPTIONS = [
  {
    value: "light",
    label: "Light",
    description: "Bright, clean and familiar.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Balanced contrast for low light.",
  },
  {
    value: "system",
    label: "System default",
    description: "Follow your device setting.",
  },
  {
    value: "midnight",
    label: "Midnight Navy",
    description: "Deep navy with champagne accents.",
  },
  {
    value: "emerald",
    label: "Emerald Reserve",
    description: "Deep green with warm ivory text.",
  },
  {
    value: "bordeaux",
    label: "Bordeaux",
    description: "Rich burgundy with refined warmth.",
  },
  {
    value: "ocean",
    label: "Ocean Mist",
    description: "Cool, airy and softly contrasted.",
  },
  {
    value: "sandstone",
    label: "Sandstone",
    description: "Warm neutral tones with clarity.",
  },
] as const satisfies ReadonlyArray<{
  value: AppearancePreference;
  label: string;
  description: string;
}>;

export function normalizeAppearance(
  value: string | null | undefined,
): AppearancePreference {
  return APPEARANCE_VALUES.includes(value as AppearancePreference)
    ? (value as AppearancePreference)
    : "light";
}

export function resolveAppearance(
  appearance: AppearancePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (appearance === "system") return prefersDark ? "dark" : "light";
  return DARK_APPEARANCE_VALUES.includes(appearance) ? "dark" : "light";
}
