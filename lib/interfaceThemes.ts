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

export const SIDEBAR_ATMOSPHERE_VALUES = [
  "none",
  "orbital",
  "lightbeam",
  "topography",
  "architectural",
  "particles",
] as const;

export const SIDEBAR_ATMOSPHERE_MODE_VALUES = ["auto", "manual"] as const;

export const SIDEBAR_ATMOSPHERE_MOTION_VALUES = [
  "animated",
  "static",
  "off",
] as const;

// Increment only when the platform intentionally changes its visual baseline.
export const FIXED_INTERFACE_PROFILE_VERSION = "coastal-photography-v4";

export type AppearancePreference = (typeof APPEARANCE_VALUES)[number];
export type BackgroundMotionPreference =
  (typeof BACKGROUND_MOTION_VALUES)[number];
export type WallpaperScenePreference =
  (typeof WALLPAPER_SCENE_VALUES)[number];
export type SidebarAtmosphereStyle =
  (typeof SIDEBAR_ATMOSPHERE_VALUES)[number];
export type SidebarAtmosphereMode =
  (typeof SIDEBAR_ATMOSPHERE_MODE_VALUES)[number];
export type SidebarAtmosphereMotion =
  (typeof SIDEBAR_ATMOSPHERE_MOTION_VALUES)[number];
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

export const SIDEBAR_ATMOSPHERE_OPTIONS = [
  {
    value: "none",
    label: "None",
    description: "Keep the sidebar completely clean.",
  },
  {
    value: "orbital",
    label: "Orbital lines",
    description: "Soft circular geometry with a quiet premium feel.",
  },
  {
    value: "lightbeam",
    label: "Light beam",
    description: "A calm vertical glow with elegant depth.",
  },
  {
    value: "topography",
    label: "Topography",
    description: "Contour lines inspired by landscapes and maps.",
  },
  {
    value: "architectural",
    label: "Architectural",
    description: "Linear structure with a refined futuristic character.",
  },
  {
    value: "particles",
    label: "Particles",
    description: "Faint star-like particles with understated motion.",
  },
] as const satisfies ReadonlyArray<{
  value: SidebarAtmosphereStyle;
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
export function normalizeSidebarAtmosphereStyle(
  value: string | null | undefined,
): SidebarAtmosphereStyle {
  return SIDEBAR_ATMOSPHERE_VALUES.includes(value as SidebarAtmosphereStyle)
    ? (value as SidebarAtmosphereStyle)
    : "none";
}

export function normalizeSidebarAtmosphereMode(
  value: string | null | undefined,
): SidebarAtmosphereMode {
  return SIDEBAR_ATMOSPHERE_MODE_VALUES.includes(value as SidebarAtmosphereMode)
    ? (value as SidebarAtmosphereMode)
    : "auto";
}

export function normalizeSidebarAtmosphereMotion(
  value: string | null | undefined,
): SidebarAtmosphereMotion {
  return SIDEBAR_ATMOSPHERE_MOTION_VALUES.includes(
    value as SidebarAtmosphereMotion,
  )
    ? (value as SidebarAtmosphereMotion)
    : "static";
}

export function resolveSidebarAtmosphereStyle(
  appearance: AppearancePreference,
  resolvedTheme: ResolvedTheme,
  wallpaperScene: WallpaperScenePreference,
  mode: SidebarAtmosphereMode,
  manualStyle: SidebarAtmosphereStyle,
): SidebarAtmosphereStyle {
  if (mode === "manual") return manualStyle;
  return "none";
}
