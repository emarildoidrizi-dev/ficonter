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
    : "animated";
}

export function resolveSidebarAtmosphereStyle(
  appearance: AppearancePreference,
  resolvedTheme: ResolvedTheme,
  wallpaperScene: WallpaperScenePreference,
  mode: SidebarAtmosphereMode,
  manualStyle: SidebarAtmosphereStyle,
): SidebarAtmosphereStyle {
  if (mode === "manual") return manualStyle;

  switch (wallpaperScene) {
    case "space-nebula":
      return "orbital";
    case "aurora":
      return "lightbeam";
    case "ocean-horizon":
    case "sand-dunes":
    case "forest-mist":
      return "topography";
    case "marble-glow":
    case "future-grid":
      return "architectural";
    case "minimal-luxe":
      return resolvedTheme === "dark" || appearance === "midnight"
        ? "orbital"
        : "none";
    default:
      return "none";
  }
}

