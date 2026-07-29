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

export const BACKGROUND_MOTION_VALUES = [
  "animated",
  "static",
  "off",
] as const;

export const WALLPAPER_SCENE_VALUES = [
  "space-nebula",
  "aurora",
  "ocean-horizon",
  "sand-dunes",
  "marble-glow",
  "future-grid",
  "forest-mist",
  "minimal-luxe",
] as const;

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
    value: "space-nebula",
    label: "Space Nebula",
    description: "Stars, orbital light and a calm deep-space nebula.",
  },
  {
    value: "aurora",
    label: "Aurora",
    description: "Northern lights above a quiet mountain horizon.",
  },
  {
    value: "ocean-horizon",
    label: "Ocean Horizon",
    description: "A tranquil sea, distant sun and layered waves.",
  },
  {
    value: "sand-dunes",
    label: "Sand Dunes",
    description: "Warm sculpted dunes with soft evening light.",
  },
  {
    value: "marble-glow",
    label: "Marble Glow",
    description: "Refined stone texture with subtle luminous veining.",
  },
  {
    value: "future-grid",
    label: "Future Grid",
    description: "A restrained command-centre horizon and perspective grid.",
  },
  {
    value: "forest-mist",
    label: "Forest Mist",
    description: "Layered evergreen silhouettes and quiet atmospheric fog.",
  },
  {
    value: "minimal-luxe",
    label: "Minimal Luxe",
    description: "Soft architectural arcs and a premium neutral atmosphere.",
  },
] as const satisfies ReadonlyArray<{
  value: WallpaperScenePreference;
  label: string;
  description: string;
}>;

export const BACKGROUND_MOTION_OPTIONS = [
  {
    value: "animated",
    label: "Animated",
    description: "Very slow movement and depth behind the workspace.",
  },
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
    : "animated";
}

export function normalizeWallpaperScene(
  value: string | null | undefined,
): WallpaperScenePreference {
  return WALLPAPER_SCENE_VALUES.includes(value as WallpaperScenePreference)
    ? (value as WallpaperScenePreference)
    : "space-nebula";
}

export function resolveAppearance(
  appearance: AppearancePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (appearance === "system") return prefersDark ? "dark" : "light";
  return DARK_APPEARANCE_VALUES.includes(appearance) ? "dark" : "light";
}
