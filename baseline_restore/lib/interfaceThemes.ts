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

export const BACKGROUND_MOTION_VALUES = ["static", "off"] as const;

export const WALLPAPER_SCENE_VALUES = [
  "coastal-island",
  "ocean-horizon",
  "sand-dunes",
] as const;

// Increment only when the platform intentionally changes its visual baseline.
export const FIXED_INTERFACE_PROFILE_VERSION = "coastal-photography-v4";

export type AppearancePreference = (typeof APPEARANCE_VALUES)[number];
export type BackgroundMotionPreference =
  (typeof BACKGROUND_MOTION_VALUES)[number];
export type WallpaperScenePreference =
  (typeof WALLPAPER_SCENE_VALUES)[number];
export type ResolvedTheme = "light" | "dark";

export const DARK_APPEARANCE_VALUES: AppearancePreference[] = [
  "dark",
  "midnight",
  "emerald",
  "bordeaux",
];

export const INTERFACE_THEME_OPTIONS = [
  { value: "light", label: "Light", description: "Bright, clean and familiar." },
  { value: "dark", label: "Dark", description: "Balanced contrast for low light." },
  { value: "system", label: "System default", description: "Follow your device setting." },
  { value: "midnight", label: "Midnight Navy", description: "Deep navy with champagne accents." },
  { value: "emerald", label: "Emerald Reserve", description: "Deep green with warm ivory text." },
  { value: "bordeaux", label: "Bordeaux", description: "Rich burgundy with refined warmth." },
  { value: "ocean", label: "Ocean Mist", description: "Cool, airy and softly contrasted." },
  { value: "sandstone", label: "Sandstone", description: "Warm neutral tones with clarity." },
] as const satisfies ReadonlyArray<{
  value: AppearancePreference;
  label: string;
  description: string;
}>;

export const WALLPAPER_SCENE_OPTIONS = [
  {
    value: "coastal-island",
    label: "Real Coastal Beach",
    description: "A real sunlit shoreline with turquoise water and natural sand.",
  },
  {
    value: "ocean-horizon",
    label: "Real Ocean Sun",
    description: "A real calm sea with natural sunlight across the water.",
  },
  {
    value: "sand-dunes",
    label: "Real Sand Beach",
    description: "A real open beach with pale sand and clear Mediterranean water.",
  },
] as const satisfies ReadonlyArray<{
  value: WallpaperScenePreference;
  label: string;
  description: string;
}>;

export const BACKGROUND_MOTION_OPTIONS = [
  {
    value: "static",
    label: "Static",
    description: "Keep the selected scene without any movement.",
  },
  {
    value: "off",
    label: "Off",
    description: "Hide the wallpaper and use the standard theme background.",
  },
] as const satisfies ReadonlyArray<{
  value: BackgroundMotionPreference;
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

export function normalizeBackgroundMotion(
  value: string | null | undefined,
): BackgroundMotionPreference {
  return BACKGROUND_MOTION_VALUES.includes(value as BackgroundMotionPreference)
    ? (value as BackgroundMotionPreference)
    : "static";
}

export function normalizeWallpaperScene(
  value: string | null | undefined,
): WallpaperScenePreference {
  return WALLPAPER_SCENE_VALUES.includes(value as WallpaperScenePreference)
    ? (value as WallpaperScenePreference)
    : "coastal-island";
}

export function resolveAppearance(
  appearance: AppearancePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (appearance === "system") return prefersDark ? "dark" : "light";
  return DARK_APPEARANCE_VALUES.includes(appearance) ? "dark" : "light";
}
