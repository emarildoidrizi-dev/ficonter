"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PayPalSubscriptionCheckout from "./PayPalSubscriptionCheckout";
import {
  Bell,
  Camera,
  Check,
  ChevronRight,
  CircleUserRound,
  CreditCard,
  Database,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FileText,
  FileType2,
  KeyRound,
  LayoutTemplate,
  LockKeyhole,
  LogOut,
  Mail,
  Monitor,
  Palette,
  ReceiptText,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { createClient, saveTrustedDevicePreference } from "@/lib/supabase/client";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import {
  createAccountPdf,
  triggerDownload,
  type AccountExportPayload,
  type AccountExportTable,
} from "@/lib/accountExport";
import {
  INTERFACE_THEME_OPTIONS,
  normalizeAppearance,
  normalizeBackgroundMotion,
  normalizeWallpaperScene,
  normalizeSurfaceOpacity,
  resolveAppearance,
  type AppearancePreference,
  type BackgroundMotionPreference,
  type WallpaperScenePreference,
} from "@/lib/interfaceThemes";
import { DAYPART_WALLPAPER_SCHEDULE } from "@/lib/daypart";
import { normalizeLanguage, type FiconterLanguage } from "@/lib/i18n/config";
import {
  CURRENCY_CODES,
  currencyName,
  type CurrencyCode,
} from "@/lib/financialOptions";
import {
  DEFAULT_BASE_CURRENCY,
  normalizeCurrency,
} from "@/lib/finance/currencyEngine";
import { BASE_CURRENCY_CHANGED_EVENT } from "./BaseCurrencyBootstrap";
import { getExchangeRate } from "@/lib/performance/exchangeRateCache";
import { useLanguage } from "./LanguageProvider";
import {
  PUBLIC_SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PLANS,
  getRequiredSubscriptionPlan,
  getSubscriptionFeatureDefinition,
  hasSubscriptionFeature,
  isSubscriptionAccessActive,
  normalizeSubscriptionPlan,
  normalizeSubscriptionStatus,
  type BillingInterval,
  type SubscriptionFeature,
} from "@/lib/subscriptionPlans";
import styles from "./SettingsWorkspace.module.css";

type Metadata = Record<string, unknown>;
type AuthIdentityUser = {
  email?: string | null;
  new_email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};
type SectionId =
  | "profile"
  | "security"
  | "financial"
  | "notifications"
  | "appearance"
  | "privacy"
  | "subscription";

type Preferences = {
  currency: string;
  numberFormat: string;
  dateFormat: string;
  weekStart: string;
  plannerStartBalance: string;
  density: "comfortable" | "compact";
  appearance: AppearancePreference;
  backgroundMotion: BackgroundMotionPreference;
  wallpaperScene: WallpaperScenePreference;
  surfaceOpacity: number;
  language: FiconterLanguage;
  notifications: {
    billReminders: boolean;
    upcomingPayments: boolean;
    goalProgress: boolean;
    monthlySummary: boolean;
    emailEnabled: boolean;
  };
};

type SubscriptionSnapshot = {
  plan_code?: string | null;
  status?: string | null;
  billing_interval?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  provider?: string | null;
};

type BillingHistoryTransaction = {
  id: string;
  status: string;
  time: string;
  amount: {
    currency: string;
    value: string;
  };
  fee?: {
    currency: string;
    value: string;
  } | null;
  net?: {
    currency: string;
    value: string;
  } | null;
};

type SaveFeedback = {
  type: "success" | "error";
  text: string;
};

type SaveFeedbackKey =
  | "profile"
  | "security"
  | "baseCurrency"
  | "financialPreferences"
  | "notifications"
  | "appearance";

type Props = {
  userId: string;
  email: string;
  metadata: Metadata;
  initialBaseCurrency?: string;
  initialSection?: string;
  subscription?: SubscriptionSnapshot | null;
  requiredFeature?: SubscriptionFeature | null;
  isSubscriptionExempt?: boolean;
  canManageWallpapers?: boolean;
};

type DialogState =
  | null
  | "delete-records"
  | "delete-account"
  | "privacy"
  | "retention"
  | "cancel-subscription";
type ExportKind = null | "transactions" | "json" | "pdf";
const FREE_APPEARANCE_THEME_VALUES = new Set<AppearancePreference>([
  "light",
  "dark",
  "system",
]);

function isSectionId(value: string | undefined): value is SectionId {
  return Boolean(
    value &&
      [
        "profile",
        "security",
        "financial",
        "notifications",
        "appearance",
        "privacy",
        "subscription",
      ].includes(value),
  );
}

const sections = [
  { id: "profile", label: "Profile", description: "Profile photo", icon: CircleUserRound },
  { id: "security", label: "Account & security", description: "Login, password and sessions", icon: LockKeyhole },
  { id: "financial", label: "Financial preferences", description: "Currency, formats and planner", icon: WalletCards },
  { id: "notifications", label: "Notifications", description: "Reminders and summaries", icon: Bell },
  { id: "appearance", label: "Appearance", description: "Theme, motion and density", icon: Palette },
  { id: "privacy", label: "Data & privacy", description: "Exports and account controls", icon: Database },
  { id: "subscription", label: "Subscription", description: "Plan and billing", icon: CreditCard },
] as const;

const defaultPreferences: Preferences = {
  currency: "EUR",
  numberFormat: "de-DE",
  dateFormat: "DD/MM/YYYY",
  weekStart: "monday",
  plannerStartBalance: "manual",
  density: "comfortable",
  appearance: "light",
  backgroundMotion: "static",
  wallpaperScene: "coastal-island",
  surfaceOpacity: 100,
  language: "en",
  notifications: {
    billReminders: true,
    upcomingPayments: true,
    goalProgress: true,
    monthlySummary: true,
    emailEnabled: true,
  },
};

function readPreferences(metadata: Metadata): Preferences {
  const storedWithRetiredPreferences =
    metadata.ficonter_preferences &&
    typeof metadata.ficonter_preferences === "object"
      ? (metadata.ficonter_preferences as Partial<Preferences> & {
          layout?: unknown;
        })
      : {};
  const { layout: _legacyLayout, ...activePreferences } =
    storedWithRetiredPreferences;
  const stored = { ...activePreferences } as Partial<Preferences> &
    Record<string, unknown>;

  for (const retiredKey of [
    "sidebarAtmosphereMode",
    "sidebarAtmosphereStyle",
    "sidebarAtmosphereMotion",
  ]) {
    delete stored[retiredKey];
  }

  return {
    ...defaultPreferences,
    ...stored,
    appearance: normalizeAppearance(
      typeof stored.appearance === "string" ? stored.appearance : undefined,
    ),
    backgroundMotion: normalizeBackgroundMotion(
      typeof stored.backgroundMotion === "string"
        ? stored.backgroundMotion
        : undefined,
    ),
    wallpaperScene: normalizeWallpaperScene(
      typeof stored.wallpaperScene === "string"
        ? stored.wallpaperScene
        : undefined,
    ),
    surfaceOpacity: normalizeSurfaceOpacity(stored.surfaceOpacity),
    language: normalizeLanguage(stored.language),
    notifications: {
      ...defaultPreferences.notifications,
      ...(stored.notifications ?? {}),
    },
  };
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function currentDeviceLabel() {
  if (typeof navigator === "undefined") return "Current browser";
  const platform = navigator.platform || "Device";
  const browser = navigator.userAgent.includes("Chrome")
    ? "Chrome"
    : navigator.userAgent.includes("Safari")
      ? "Safari"
      : navigator.userAgent.includes("Firefox")
        ? "Firefox"
        : "Browser";
  return `${browser} on ${platform}`;
}

function applyInterfaceDom(preferences: Preferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = resolveAppearance(preferences.appearance, prefersDark);

  // One synchronous DOM commit is the source of truth for the live preview.
  // Colour palette and V1.33 typography both read these same root attributes,
  // so they update in the same browser style recalculation with no refresh.
  root.dataset.theme = preferences.appearance;
  root.dataset.resolvedTheme = resolvedTheme;
  root.dataset.density = preferences.density;
  root.dataset.backgroundMotion = preferences.backgroundMotion;
  root.dataset.wallpaperScene = preferences.wallpaperScene;
  root.dataset.surfaceOpacity = String(preferences.surfaceOpacity);
  root.style.setProperty(
    "--ficonter-surface-opacity",
    `${normalizeSurfaceOpacity(preferences.surfaceOpacity)}%`,
  );
  delete root.dataset.sidebarAtmosphereMode;
  delete root.dataset.sidebarAtmosphereStyle;
  delete root.dataset.sidebarAtmosphereMotion;
  root.style.colorScheme = resolvedTheme;
}

function applyInterfacePreview(preferences: Preferences) {
  // Preview deliberately does not touch localStorage or Supabase.
  // Save appearance remains the only persistence boundary.
  applyInterfaceDom(preferences);
}

function applyInterface(preferences: Preferences) {
  applyInterfaceDom(preferences);

  try {
    localStorage.setItem("ficonter-appearance", preferences.appearance);
    localStorage.setItem("ficonter-density", preferences.density);
    localStorage.removeItem("ficonter-layout");
    localStorage.setItem("ficonter-background-motion", preferences.backgroundMotion);
    localStorage.setItem("ficonter-wallpaper-scene", preferences.wallpaperScene);
    localStorage.setItem(
      "ficonter-surface-opacity",
      String(normalizeSurfaceOpacity(preferences.surfaceOpacity)),
    );
    localStorage.removeItem("ficonter-sidebar-atmosphere-mode");
    localStorage.removeItem("ficonter-sidebar-atmosphere-style");
    localStorage.removeItem("ficonter-sidebar-atmosphere-motion");
  } catch {
    // The interface still updates when browser storage is unavailable.
  }
}

async function compressProfilePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Choose an image smaller than 8 MB.");
  }

  const image = document.createElement("img");
  const objectUrl = URL.createObjectURL(file);

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The image could not be read."));
      image.src = objectUrl;
    });

    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("The image could not be processed.");

    const scale = Math.max(size / image.width, size / image.height);
    const width = image.width * scale;
    const height = image.height * scale;

    context.drawImage(
      image,
      (size - width) / 2,
      (size - height) / 2,
      width,
      height,
    );

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("The image could not be compressed."));
        },
        "image/jpeg",
        0.82,
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function readEmailIdentity(
  user: AuthIdentityUser | null | undefined,
  fallbackEmail: string,
  fallbackPending: string,
) {
  const current = String(user?.email ?? fallbackEmail).trim().toLowerCase();
  const storedPending = String(
    user?.user_metadata?.pending_email_change ?? fallbackPending,
  )
    .trim()
    .toLowerCase();
  const authPending = String(user?.new_email ?? "").trim().toLowerCase();
  const pending = authPending || (storedPending && storedPending !== current ? storedPending : "");

  return { current, pending };
}

function emailChangeRedirectUrl() {
  if (typeof window === "undefined") return undefined;
  const next = encodeURIComponent("/dashboard/settings?section=profile");
  return `${window.location.origin}/auth/callback?next=${next}`;
}

function formatSubscriptionDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatBillingAmount(
  currency: string | null | undefined,
  value: string | null | undefined,
) {
  const amount = Number(value ?? 0);
  const currencyCode = String(currency || "EUR").toUpperCase();

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${currencyCode} ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
  }
}

export function SettingsWorkspace({
  userId,
  email,
  metadata,
  initialBaseCurrency = DEFAULT_BASE_CURRENCY,
  initialSection,
  subscription,
  requiredFeature = null,
  isSubscriptionExempt = false,
  canManageWallpapers = false,
}: Props) {
  const { language, locale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [subscriptionPreviewInterval, setSubscriptionPreviewInterval] =
    useState<Exclude<BillingInterval, null>>("monthly");
  const [subscriptionCanceling, setSubscriptionCanceling] = useState(false);
  const [betaActivationCode, setBetaActivationCode] = useState("");
  const [betaActivating, setBetaActivating] = useState(false);
  const [billingHistory, setBillingHistory] = useState<BillingHistoryTransaction[]>([]);
  const [billingHistoryLoading, setBillingHistoryLoading] = useState(false);
  const [billingHistoryError, setBillingHistoryError] = useState("");
  const [billingHistoryReloadKey, setBillingHistoryReloadKey] = useState(0);
  const photoInput = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<SectionId>(() =>
    isSubscriptionExempt && initialSection === "subscription"
      ? "security"
      : isSectionId(initialSection)
        ? initialSection
        : "security",
  );
  const [mobileDetailOpen, setMobileDetailOpen] = useState(() =>
    isSectionId(initialSection) &&
    !(isSubscriptionExempt && initialSection === "subscription"),
  );
  const [fullName, setFullName] = useState(String(metadata.full_name ?? metadata.name ?? ""));
  const [displayName, setDisplayName] = useState(String(metadata.display_name ?? metadata.full_name ?? ""));
  const [profilePhoto, setProfilePhoto] = useState("");
  const [profilePhotoPath, setProfilePhotoPath] = useState(
    String(metadata.avatar_path ?? ""),
  );
  const [pendingPhoto, setPendingPhoto] = useState<Blob | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const initialPendingEmail = String(metadata.pending_email_change ?? "")
    .trim()
    .toLowerCase();
  const [currentEmail, setCurrentEmail] = useState(email.trim().toLowerCase());
  const [pendingEmail, setPendingEmail] = useState(initialPendingEmail);
  const [accountEmail, setAccountEmail] = useState(initialPendingEmail || email);
  const [emailRequesting, setEmailRequesting] = useState(false);
  const [emailResending, setEmailResending] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(() => readPreferences(metadata));
  const [savedPreferences, setSavedPreferences] = useState<Preferences>(() => readPreferences(metadata));
  const savedPreferencesRef = useRef(savedPreferences);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>(() =>
    normalizeCurrency(
      initialBaseCurrency || readPreferences(metadata).currency,
      DEFAULT_BASE_CURRENCY,
    ),
  );
  const [savedBaseCurrency, setSavedBaseCurrency] = useState<CurrencyCode>(() =>
    normalizeCurrency(
      initialBaseCurrency || readPreferences(metadata).currency,
      DEFAULT_BASE_CURRENCY,
    ),
  );
  const currencyOptions = useMemo<[string, string][]>(
    () =>
      CURRENCY_CODES.map(
        (code) =>
          [
            code,
            `${code} — ${currencyName(code, locale)}`,
          ] as [string, string],
      ).sort((a, b) =>
        a[1].localeCompare(b[1], locale, { sensitivity: "base" }),
      ),
    [locale],
  );
  const [rememberDevice, setRememberDevice] = useState(false);
  const [savedRememberDevice, setSavedRememberDevice] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<ExportKind>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<
    Partial<Record<SaveFeedbackKey, SaveFeedback>>
  >({});
  const saveFeedbackTimers = useRef<
    Partial<Record<SaveFeedbackKey, number>>
  >({});

  useLayoutEffect(() => {
    if (!isSectionId(initialSection)) {
      setMobileDetailOpen(false);
      return;
    }

    // Owner / Super Admin / Admin never enter the customer Subscription area.
    // Their access is role-based and does not require a plan or payment.
    const nextSection =
      isSubscriptionExempt && initialSection === "subscription"
        ? "security"
        : initialSection;

    setActive(nextSection);
    setMobileDetailOpen(true);
    setMessage(null);
    setSaveFeedback({});
  }, [initialSection, isSubscriptionExempt]);

  useEffect(() => {
    return () => {
      Object.values(saveFeedbackTimers.current).forEach((timer) => {
        if (timer) window.clearTimeout(timer);
      });
    };
  }, []);

  useEffect(() => {
    if (
      active !== "subscription" ||
      subscription?.provider !== "paypal"
    ) {
      return;
    }

    let cancelled = false;

    async function loadBillingHistory() {
      setBillingHistoryLoading(true);
      setBillingHistoryError("");

      try {
        const response = await fetch("/api/paypal/billing-history", {
          method: "GET",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => ({}))) as {
          transactions?: BillingHistoryTransaction[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            payload.error || "Billing history could not be loaded.",
          );
        }

        if (!cancelled) {
          setBillingHistory(
            Array.isArray(payload.transactions)
              ? payload.transactions
              : [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          setBillingHistoryError(
            error instanceof Error
              ? error.message
              : "Billing history could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setBillingHistoryLoading(false);
        }
      }
    }

    void loadBillingHistory();

    return () => {
      cancelled = true;
    };
  }, [
    active,
    subscription?.provider,
    subscription?.plan_code,
    subscription?.billing_interval,
    billingHistoryReloadKey,
  ]);

  useEffect(() => {
    setPreferences((current) =>
      current.language === language ? current : { ...current, language },
    );
    setSavedPreferences((current) =>
      current.language === language ? current : { ...current, language },
    );
  }, [language]);

  useEffect(() => {
    const normalized = normalizeCurrency(initialBaseCurrency, DEFAULT_BASE_CURRENCY);
    setBaseCurrency(normalized);
    setSavedBaseCurrency(normalized);
  }, [initialBaseCurrency]);

  useEffect(() => {
    let active = true;

    function syncIdentity(user: AuthIdentityUser | null | undefined) {
      if (!active) return;
      const identity = readEmailIdentity(user, email, initialPendingEmail);
      setCurrentEmail(identity.current);
      setPendingEmail(identity.pending);
      setAccountEmail(identity.pending || identity.current);
      window.dispatchEvent(
        new CustomEvent("ficonter:profile-updated", {
          detail: { email: identity.current },
        }),
      );
    }

    void supabase.auth.getUser().then(({ data }) => syncIdentity(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      syncIdentity(session?.user);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [email, initialPendingEmail, supabase]);

  useEffect(() => {
    const cookies = document.cookie
      .split(";")
      .map((item) => item.trim());
    const trusted = cookies.includes("ficonter_trusted_device=1");
    setRememberDevice(trusted);
    setSavedRememberDevice(trusted);
    savedPreferencesRef.current = savedPreferences;
    applyInterface(savedPreferences);
  }, []);

  useEffect(() => {
    savedPreferencesRef.current = savedPreferences;
  }, [savedPreferences]);

  useEffect(() => () => {
    // If Settings is left while Appearance is only being previewed, restore the
    // last committed interface immediately. This preserves explicit Save.
    applyInterfacePreview(savedPreferencesRef.current);
  }, []);

  useEffect(() => {
    // Settings edits are drafts until an explicit Save action succeeds.
    // Moving to another section discards any unconfirmed changes.
    if (active !== "appearance") {
      applyInterfacePreview(savedPreferences);
    }
    setPreferences(savedPreferences);
    setBaseCurrency(savedBaseCurrency);
    setRememberDevice(savedRememberDevice);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage(null);
    setSaveFeedback({});
  }, [active]);

  useEffect(() => {
    let mounted = true;

    async function loadProfilePhoto() {
      if (!profilePhotoPath) {
        setProfilePhoto("");
        return;
      }

      const { data, error } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(profilePhotoPath, 60 * 60);

      if (!mounted) return;

      if (error) {
        setProfilePhoto("");
        return;
      }

      setProfilePhoto(data.signedUrl);
    }

    void loadProfilePhoto();

    return () => {
      mounted = false;
    };
  }, [profilePhotoPath, supabase]);

  function showSuccess(text: string) {
    setMessage({ type: "success", text });
    window.setTimeout(() => setMessage(null), 3600);
  }

  function showError(error: unknown, fallback: string) {
    setMessage({ type: "error", text: error instanceof Error ? error.message : fallback });
  }

  function clearSaveFeedback(key: SaveFeedbackKey) {
    const currentTimer = saveFeedbackTimers.current[key];
    if (currentTimer) {
      window.clearTimeout(currentTimer);
      delete saveFeedbackTimers.current[key];
    }

    setSaveFeedback((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function showLocalSaveFeedback(
    key: SaveFeedbackKey,
    type: SaveFeedback["type"],
    text: string,
  ) {
    const currentTimer = saveFeedbackTimers.current[key];
    if (currentTimer) window.clearTimeout(currentTimer);

    setSaveFeedback((current) => ({
      ...current,
      [key]: { type, text },
    }));

    saveFeedbackTimers.current[key] = window.setTimeout(() => {
      setSaveFeedback((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      delete saveFeedbackTimers.current[key];
    }, 4200);
  }

  function localSaveFeedback(key: SaveFeedbackKey) {
    const feedback = saveFeedback[key];
    if (!feedback) return null;

    return (
      <span
        className={`${styles.actionFeedback} ${
          feedback.type === "error"
            ? styles.actionFeedbackError
            : styles.actionFeedbackSuccess
        }`}
        role="status"
        aria-live="polite"
      >
        {feedback.type === "success" ? <Check size={15} /> : null}
        {feedback.text}
      </span>
    );
  }

  async function saveMetadata(nextData: Metadata) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const current = user?.user_metadata ?? metadata;
    const { avatar_data_url: _legacyAvatar, ...safeCurrent } = current;

    const { error } = await supabase.auth.updateUser({
      data: {
        ...safeCurrent,
        ...nextData,
        avatar_data_url: null,
      },
    });

    if (error) throw error;
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    clearSaveFeedback("profile");

    try {
      let nextPhotoPath = profilePhotoPath;

      if (removePhoto && profilePhotoPath) {
        const { error: removeError } = await supabase.storage
          .from("profile-photos")
          .remove([profilePhotoPath]);

        if (removeError) throw removeError;
        nextPhotoPath = "";
      }

      if (pendingPhoto) {
        const uploadPath = `${userId}/avatar.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(uploadPath, pendingPhoto, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) throw uploadError;
        nextPhotoPath = uploadPath;
      }

      await saveMetadata({
        full_name: fullName.trim(),
        display_name: displayName.trim(),
        avatar_path: nextPhotoPath || null,
      });

      setProfilePhotoPath(nextPhotoPath);
      setPendingPhoto(null);
      setRemovePhoto(false);

      if (!nextPhotoPath) {
        setProfilePhoto("");
      } else {
        const { data, error: signedUrlError } = await supabase.storage
          .from("profile-photos")
          .createSignedUrl(nextPhotoPath, 60 * 60);

        if (signedUrlError) throw signedUrlError;
        setProfilePhoto(data.signedUrl);
      }

      window.dispatchEvent(
        new CustomEvent("ficonter:profile-updated", {
          detail: {
            fullName,
            displayName,
            email: currentEmail,
            profilePhotoPath: nextPhotoPath,
          },
        }),
      );

      showLocalSaveFeedback("profile", "success", "Profile changes saved.");
    } catch (error) {
      showLocalSaveFeedback(
        "profile",
        "error",
        error instanceof Error ? error.message : "Your profile could not be updated.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage(null);

    try {
      const compressed = await compressProfilePhoto(file);
      const previewUrl = URL.createObjectURL(compressed);

      setPendingPhoto(compressed);
      setRemovePhoto(false);
      setProfilePhoto((current) => {
        if (current.startsWith("blob:")) URL.revokeObjectURL(current);
        return previewUrl;
      });

      showSuccess("Photo prepared. Select Save changes to upload it securely.");
    } catch (error) {
      showError(error, "The profile photo could not be prepared.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emailRequesting) return;

    setEmailRequesting(true);
    setMessage(null);

    try {
      const nextEmail = accountEmail.trim().toLowerCase();
      if (!nextEmail || !nextEmail.includes("@")) {
        throw new Error("Enter a valid email address.");
      }
      if (nextEmail === currentEmail && !pendingEmail) {
        showSuccess("Your email address is unchanged.");
        return;
      }

      const { data, error } = await supabase.auth.updateUser(
        { email: nextEmail },
        { emailRedirectTo: emailChangeRedirectUrl() },
      );
      if (error) throw error;

      await saveMetadata({
        pending_email_change: nextEmail,
        pending_email_change_requested_at: new Date().toISOString(),
      });

      const identity = readEmailIdentity(
        data.user as AuthIdentityUser | null,
        currentEmail,
        nextEmail,
      );
      setCurrentEmail(identity.current);
      setPendingEmail(identity.pending || nextEmail);
      setAccountEmail(identity.pending || nextEmail);
      showSuccess(
        "Confirmation link sent. Your current email remains active until the change is confirmed.",
      );
    } catch (error) {
      showError(error, "Your email address could not be updated.");
    } finally {
      setEmailRequesting(false);
    }
  }

  async function resendEmailChange() {
    if (!pendingEmail || emailResending) return;
    setEmailResending(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resend({
        type: "email_change",
        email: pendingEmail,
        options: { emailRedirectTo: emailChangeRedirectUrl() },
      });
      if (error) throw error;
      showSuccess("A new confirmation link was sent to the pending email address.");
    } catch (error) {
      showError(error, "The confirmation link could not be resent.");
    } finally {
      setEmailResending(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (newPassword.length < 8) return setMessage({ type: "error", text: "Use at least eight characters." });
    if (newPassword !== confirmPassword) return setMessage({ type: "error", text: "The new passwords do not match." });
    setLoading(true);
    try {
      if (currentPassword) {
        const { error } = await supabase.auth.signInWithPassword({ email: currentEmail, password: currentPassword });
        if (error) throw new Error("Your current password is incorrect.");
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showSuccess("Your password has been changed.");
    } catch (error) {
      showError(error, "Your password could not be changed.");
    } finally {
      setLoading(false);
    }
  }

  async function savePreferences(
    next: Preferences,
    text: string,
    feedbackKey: Extract<
      SaveFeedbackKey,
      "financialPreferences" | "notifications" | "appearance"
    >,
  ) {
    setLoading(true);
    setMessage(null);
    clearSaveFeedback(feedbackKey);
    try {
      await saveMetadata({ ficonter_preferences: next });
      setPreferences(next);
      setSavedPreferences(next);
      savedPreferencesRef.current = next;
      applyInterface(next);
      window.dispatchEvent(new CustomEvent("ficonter:preferences-updated", { detail: next }));
      showLocalSaveFeedback(feedbackKey, "success", text);
    } catch (error) {
      showLocalSaveFeedback(
        feedbackKey,
        "error",
        error instanceof Error ? error.message : "Your preferences could not be saved.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveBaseCurrency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    clearSaveFeedback("baseCurrency");

    try {
      const normalized = normalizeCurrency(
        baseCurrency,
        DEFAULT_BASE_CURRENCY,
      );

      if (normalized !== DEFAULT_BASE_CURRENCY) {
        await getExchangeRate(DEFAULT_BASE_CURRENCY, normalized, {
          forceRefresh: true,
        });
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ base_currency: normalized })
        .eq("id", userId);

      if (profileError) throw profileError;

      const nextPreferences: Preferences = {
        ...preferences,
        currency: normalized,
      };

      await saveMetadata({
        ficonter_base_currency: normalized,
        ficonter_preferences: nextPreferences,
      });

      setBaseCurrency(normalized);
      setSavedBaseCurrency(normalized);
      setPreferences(nextPreferences);
      setSavedPreferences(nextPreferences);

      try {
        localStorage.setItem(
          "ficonter-personal-base-currency",
          normalized,
        );
      } catch {
        // The profile remains the source of truth.
      }

      document.documentElement.dataset.baseCurrency = normalized;

      window.dispatchEvent(
        new CustomEvent(BASE_CURRENCY_CHANGED_EVENT, {
          detail: {
            currency: normalized,
            workspace: "personal",
          },
        }),
      );

      window.dispatchEvent(
        new CustomEvent("ficonter:preferences-updated", {
          detail: nextPreferences,
        }),
      );

      showLocalSaveFeedback(
        "baseCurrency",
        "success",
        "Your base currency has been saved.",
      );
    } catch (error) {
      showLocalSaveFeedback(
        "baseCurrency",
        "error",
        error instanceof Error ? error.message : "Your base currency could not be saved.",
      );
    } finally {
      setLoading(false);
    }
  }

  function saveRememberDevice() {
    clearSaveFeedback("security");
    saveTrustedDevicePreference(rememberDevice);
    setSavedRememberDevice(rememberDevice);
    showLocalSaveFeedback(
      "security",
      "success",
      rememberDevice
        ? "Persistent login preference saved."
        : "Persistent login preference disabled.",
    );
  }

  async function signOutOtherSessions() {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      showSuccess("Other sessions were signed out.");
    } catch (error) {
      showError(error, "Other sessions could not be signed out.");
    } finally {
      setLoading(false);
    }
  }

  async function signOutEverywhere() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      window.location.assign("/login");
    } catch (error) {
      showError(error, "You could not be signed out from all devices.");
      setLoading(false);
    }
  }

  async function exportTransactions() {
    setExporting("transactions");
    setMessage(null);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as Record<string, unknown>[];
      const columns = rows.length ? Object.keys(rows[0]) : ["No transactions"];
      const csv = [columns.map(csvCell).join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n");
      downloadFile(`ficonter-transactions-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
      showSuccess("Transaction CSV downloaded.");
    } catch (error) {
      showError(error, "Transactions could not be exported.");
    } finally {
      setExporting(null);
    }
  }

  async function loadAccountExport(): Promise<AccountExportPayload> {
    type ExportQueryResult = {
      data: unknown[] | null;
      error: { message: string } | null;
    };

    async function collectUserRows(
      table: AccountExportTable,
      query: PromiseLike<ExportQueryResult>,
    ) {
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return [table, (data ?? []) as Record<string, unknown>[]] as const;
    }

    const results: Array<
      readonly [AccountExportTable, Record<string, unknown>[]]
    > = await Promise.all([
      collectUserRows(
        "transactions",
        supabase.from("transactions").select("*").eq("user_id", userId),
      ),
      collectUserRows(
        "bills",
        supabase.from("bills").select("*").eq("user_id", userId),
      ),
      collectUserRows(
        "goals",
        supabase.from("goals").select("*").eq("user_id", userId),
      ),
      collectUserRows(
        "goal_investments",
        supabase.from("goal_investments").select("*").eq("user_id", userId),
      ),
      collectUserRows(
        "debts",
        supabase.from("debts").select("*").eq("user_id", userId),
      ),
      collectUserRows(
        "debt_payments",
        supabase.from("debt_payments").select("*").eq("user_id", userId),
      ),
      collectUserRows(
        "credit_card_activities",
        supabase
          .from("credit_card_activities")
          .select("*")
          .eq("user_id", userId),
      ),
      collectUserRows(
        "credit_card_monthly_records",
        supabase
          .from("credit_card_monthly_records")
          .select("*")
          .eq("user_id", userId),
      ),
      collectUserRows(
        "monthly_budget_plans",
        supabase
          .from("monthly_budget_plans")
          .select("*")
          .eq("user_id", userId),
      ),
      collectUserRows(
        "monthly_budget_items",
        supabase
          .from("monthly_budget_items")
          .select("*")
          .eq("user_id", userId),
      ),
      collectUserRows(
        "financial_documents",
        supabase
          .from("financial_documents")
          .select("*")
          .eq("user_id", userId),
      ),
      collectUserRows(
        "support_requests",
        supabase.from("support_requests").select("*").eq("user_id", userId),
      ),
      collectUserRows(
        "user_notifications",
        supabase.from("user_notifications").select("*").eq("user_id", userId),
      ),
    ]);

    const { data: supportMessages, error: supportMessagesError } = await supabase
      .from("support_messages")
      .select("*");
    if (supportMessagesError) throw supportMessagesError;
    results.push([
      "support_messages",
      (supportMessages ?? []) as Record<string, unknown>[],
    ]);

    return {
      schema_version: "1.4",
      export_type: "ficonter-account-archive",
      exported_at: new Date().toISOString(),
      privacy: {
        owner_only: true,
        excludes_authentication_secrets: true,
      },
      account: {
        id: userId,
        email,
        full_name: fullName,
        display_name: displayName,
      },
      preferences: preferences as unknown as Record<string, unknown>,
      data: Object.fromEntries(results) as AccountExportPayload["data"],
    };
  }

  async function exportAccountJson() {
    setExporting("json");
    setMessage(null);
    try {
      const payload = await loadAccountExport();
      const date = payload.exported_at.slice(0, 10);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      triggerDownload(`ficonter-account-data-${date}.json`, blob);
      showSuccess("Complete account JSON downloaded.");
    } catch (error) {
      showError(error, "Your JSON account archive could not be exported.");
    } finally {
      setExporting(null);
    }
  }

  async function exportAccountPdf() {
    setExporting("pdf");
    setMessage(null);
    try {
      const payload = await loadAccountExport();
      const date = payload.exported_at.slice(0, 10);
      const blob = await createAccountPdf(payload);
      triggerDownload(`ficonter-private-financial-report-${date}.pdf`, blob);
      showSuccess("Private financial PDF downloaded.");
    } catch (error) {
      showError(error, "Your PDF financial report could not be exported.");
    } finally {
      setExporting(null);
    }
  }

  async function deleteFinancialRecords() {
    if (confirmation !== "DELETE RECORDS") return;
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc("delete_all_financial_records");
      if (error) throw error;

      setDialog(null);
      setConfirmation("");
      notifyFiconterDataChange("all");
      showSuccess(
        "All transactions, bills, goals, debts, credit cards and planner records were deleted. Your account remains active.",
      );
    } catch (error) {
      showError(error, "Financial records could not be deleted.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAccount() {
    if (confirmation !== "DELETE ACCOUNT") return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Account deletion failed.");
      await supabase.auth.signOut({ scope: "global" });
      window.location.assign("/");
    } catch (error) {
      showError(error, "Your account could not be deleted.");
      setLoading(false);
    }
  }

  async function activateExistingBetaAccess() {
    if (betaActivating) return;

    const code = betaActivationCode.trim();
    if (!code) {
      setMessage({
        type: "error",
        text: "Enter your private Beta invitation code first.",
      });
      return;
    }

    setBetaActivating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/beta/activate", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error || "Beta access could not be activated.",
        );
      }

      setBetaActivationCode("");
      showSuccess("Private Beta access activated. Updating your account…");
      window.setTimeout(() => router.refresh(), 250);
    } catch (error) {
      showError(error, "Beta access could not be activated.");
      setBetaActivating(false);
    }
  }

  async function cancelSubscription() {
    if (subscriptionCanceling) return;

    setSubscriptionCanceling(true);
    setMessage(null);

    try {
      const response = await fetch("/api/paypal/cancel", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error || "The subscription could not be canceled.",
        );
      }

      setDialog(null);
      router.refresh();
    } catch (error) {
      showError(error, "The subscription could not be canceled.");
      setSubscriptionCanceling(false);
    }
  }

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const isNativePhone =
      root.dataset.ficonterNativeApp === "true" &&
      root.dataset.ficonterDevice === "phone";

    if (!isNativePhone) return;

    const sectionFromUrl = searchParams.get("section") ?? undefined;
    let nextSection: SectionId | null = null;

    if (
      isSectionId(sectionFromUrl) &&
      !(isSubscriptionExempt && sectionFromUrl === "subscription")
    ) {
      nextSection = sectionFromUrl;
    }

    if (nextSection) {
      setActive(nextSection);
      setMobileDetailOpen(true);
      return;
    }

    setMobileDetailOpen(false);
  }, [isSubscriptionExempt, searchParams]);

  function openSettingsSection(id: SectionId) {
    setMessage(null);
    setSaveFeedback({});

    const root = typeof document !== "undefined" ? document.documentElement : null;
    const isNativePhone =
      root?.dataset.ficonterNativeApp === "true" &&
      root.dataset.ficonterDevice === "phone";

    if (isNativePhone) {
      const target = `/dashboard/settings?section=${id}`;
      const current = `${window.location.pathname}${window.location.search}`;

      if (current === target && active === id && mobileDetailOpen) return;

      // All Settings sections are already mounted in this client workspace.
      // Switch the visible screen immediately, then update browser history
      // without asking the server to rebuild the Settings route.
      setActive(id);
      setMobileDetailOpen(true);
      window.history.pushState(null, "", target);
      return;
    }

    // Tablet/iPad/desktop-class Settings switches locally with no route delay
    // and no page-stack animation.
    if (active === id) return;
    setActive(id);
  }

  const visibleSections = isSubscriptionExempt
    ? sections.filter((section) => section.id !== "subscription")
    : sections;
  const activeSection =
    visibleSections.find((section) => section.id === active) ??
    visibleSections[0];
const currentPlanCode = normalizeSubscriptionPlan(subscription?.plan_code);
const currentSubscriptionStatus = normalizeSubscriptionStatus(subscription?.status);

const subscriptionEndLabel = formatSubscriptionDate(
  subscription?.current_period_end,
);

const cancellationPaidThrough =
  subscription?.cancel_at_period_end === true &&
  Boolean(subscription?.current_period_end) &&
  Date.parse(String(subscription?.current_period_end)) > Date.now();

const hasActiveSubscriptionAccess =
  isSubscriptionAccessActive(currentSubscriptionStatus) ||
  cancellationPaidThrough;

const effectivePlanCode =
  hasActiveSubscriptionAccess ? currentPlanCode : "free";

const currentPlan = SUBSCRIPTION_PLANS[currentPlanCode];
const settingsPlanCode = isSubscriptionExempt
  ? "business_pro"
  : effectivePlanCode;
const requiredFeatureDefinition = requiredFeature
  ? getSubscriptionFeatureDefinition(requiredFeature)
  : null;
const requiredPlanCode = requiredFeature
  ? getRequiredSubscriptionPlan(requiredFeature)
  : null;
const requiredPlan = requiredPlanCode
  ? SUBSCRIPTION_PLANS[requiredPlanCode]
  : null;
const requiredFeatureAlreadyAvailable = requiredFeature
  ? hasSubscriptionFeature(settingsPlanCode, requiredFeature)
  : true;
const canUseFinancialPreferences = hasSubscriptionFeature(
  settingsPlanCode,
  "financial_preferences",
);
const canUseNotifications = hasSubscriptionFeature(
  settingsPlanCode,
  "automatic_bill_reminders",
);
const canUseAppearanceThemes = hasSubscriptionFeature(
  settingsPlanCode,
  "appearance_themes",
);
const canUseTimeBasedWallpapers = canManageWallpapers;
const canUsePrivatePdfExport = hasSubscriptionFeature(
  settingsPlanCode,
  "private_pdf_export",
);

const subscriptionStatusLabel = cancellationPaidThrough
  ? "Active"
  : currentSubscriptionStatus === "past_due"
    ? "Past due"
    : currentSubscriptionStatus === "canceled"
      ? "Canceled"
      : currentSubscriptionStatus === "unpaid"
        ? "Unpaid"
        : currentSubscriptionStatus === "trialing"
          ? "Trialing"
          : "Active";

const canCancelSubscription =
  subscription?.provider === "paypal" &&
  (currentPlanCode === "personal_pro" ||
    currentPlanCode === "business_pro") &&
  (currentSubscriptionStatus === "active" ||
    currentSubscriptionStatus === "trialing") &&
  subscription?.cancel_at_period_end !== true;

const showSubscriptionManagement =
  subscription?.provider === "paypal" &&
  (currentPlanCode === "personal_pro" ||
    currentPlanCode === "business_pro");
  const avatarText = (displayName || fullName || email || "F").trim().slice(0, 1).toUpperCase();

  return (
    <div className={styles.workspace} data-mobile-detail={mobileDetailOpen ? "true" : "false"}>
      <aside className={styles.navigation} aria-label="Settings sections">
        <div className={styles.accountCard}>
          <div className={styles.avatar}>
            {profilePhoto ? <img src={profilePhoto} alt="Profile" /> : avatarText}
          </div>
          <div>
            <strong>{displayName || fullName || "Ficonter member"}</strong>
            <span>{email}</span>
          </div>
        </div>
        <div className={styles.sectionList}>
          {visibleSections.map(({ id, label, description, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`${styles.sectionButton}${active === id ? ` ${styles.sectionActive}` : ""}`}
              onClick={() => openSettingsSection(id)}
            >
              <span className={styles.sectionIcon}><Icon size={17} /></span>
              <span><strong>{label}</strong><small>{description}</small></span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      </aside>

      <main className={styles.panel}>
        <header className={styles.panelHeader}>
          <div><span className={styles.eyebrow}>Account preferences</span><h2>{activeSection.label}</h2><p>{activeSection.description}</p></div>
          <div className={styles.secureBadge}><ShieldCheck size={16} />Private</div>
        </header>

        {message ? <div className={`${styles.message} ${message.type === "error" ? styles.error : styles.success}`}>{message.type === "success" ? <Check size={17} /> : null}{message.text}</div> : null}

        {active === "profile" ? (
          <div className={styles.stack}>
            <form className={styles.form} onSubmit={saveProfile}>
              <div className={styles.photoEditor}>
                <div className={styles.largeAvatar}>{profilePhoto ? <img src={profilePhoto} alt="Profile preview" /> : avatarText}</div>
                <div><h3>Profile photo</h3><p>Upload a clear square image. Ficonter compresses it and stores it securely.</p><div className={styles.inlineActions}><button type="button" className={styles.secondaryButton} onClick={() => photoInput.current?.click()}><Camera size={16} />Choose photo</button>{profilePhoto ? <button type="button" className={styles.textButton} onClick={() => {
  setPendingPhoto(null);
  setRemovePhoto(true);
  setProfilePhoto("");
}}>Remove</button> : null}</div></div>
                <input ref={photoInput} className={styles.hiddenInput} type="file" accept="image/*" onChange={choosePhoto} />
              </div>
              <div className={styles.formGrid}>
                <label><span>Full name</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" maxLength={120} /></label>
                <label><span>Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="nickname" maxLength={80} /></label>
              </div>
              <div className={styles.actions}>{localSaveFeedback("profile")}<button className={styles.primaryButton} disabled={loading}><Save size={16} />{loading ? "Saving…" : "Save profile"}</button></div>
            </form>

            <form className={styles.formCard} onSubmit={updateEmail}>
              <div className={styles.cardHeading}><Mail size={19} /><div><h3>Login email</h3><p>Change the email used to sign in to Ficonter.</p></div></div>
              <div className={styles.formGrid}>
                <label><span>Current email</span><input type="email" value={currentEmail} disabled /></label>
                <label><span>New email</span><input type="email" inputMode="email" autoComplete="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} required /></label>
              </div>
              {pendingEmail ? (
                <div className={styles.pendingEmailCard} role="status">
                  <div><span className={styles.pendingLabel}>Pending confirmation</span><strong>{pendingEmail}</strong><p>Your current email remains active until the required confirmation link or links are approved.</p></div>
                  <button type="button" className={styles.secondaryButton} disabled={emailResending} onClick={() => void resendEmailChange()}>{emailResending ? "Sending…" : "Resend link"}</button>
                </div>
              ) : null}
              <div className={styles.emailSecurityNote}><ShieldCheck size={17} /><span>For security, Ficonter never changes the login email until Supabase confirms the request.</span></div>
              <div className={styles.actions}><button className={styles.secondaryButton} disabled={emailRequesting}>{emailRequesting ? "Sending confirmation…" : pendingEmail ? "Change pending email" : "Send confirmation link"}</button></div>
            </form>
          </div>
        ) : null}

        {active === "security" ? (
          <div className={styles.stack}>
            <form className={styles.formCard} onSubmit={updatePassword}>
              <div className={styles.cardHeading}><KeyRound size={19} /><div><h3>Change password</h3><p>Use at least eight characters.</p></div></div>
              <label><span>Current password</span><div className={styles.passwordField}><input type={showPassword ? "text" : "password"} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
              <div className={styles.formGrid}><label><span>New password</span><input type={showPassword ? "text" : "password"} minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><label><span>Confirm password</span><input type={showPassword ? "text" : "password"} minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label></div>
              <div className={styles.cardActions}><Link className={styles.textLink} href="/recover-account?mode=password">Forgot password?</Link><button className={styles.primaryButton} disabled={loading}>Change password</button></div>
            </form>
            <div className={styles.formCard}>
              <div className={styles.cardHeading}><Smartphone size={19} /><div><h3>Remember this device</h3><p>Keep your login active only on a private device.</p></div></div>
              <Toggle checked={rememberDevice} onChange={setRememberDevice} label="Persistent login on this device" />
              <div className={styles.actions}>
                {localSaveFeedback("security")}
                <button type="button" className={styles.primaryButton} onClick={saveRememberDevice}>
                  <Save size={16} />Save device preference
                </button>
              </div>
            </div>
            <div className={styles.formCard}>
              <div className={styles.cardHeading}><Monitor size={19} /><div><h3>Active sessions</h3><p>Supabase exposes the current browser session to the app. Other sessions can be revoked securely.</p></div></div>
              <div className={styles.sessionRow}><span className={styles.sessionIcon}><Monitor size={17} /></span><div><strong>{currentDeviceLabel()}</strong><small>Current session · active now</small></div><span className={styles.currentBadge}>Current</span></div>
              <div className={styles.cardActions}><button type="button" className={styles.secondaryButton} onClick={signOutOtherSessions} disabled={loading}>Sign out other sessions</button><button type="button" className={styles.dangerOutline} onClick={signOutEverywhere} disabled={loading}><LogOut size={16} />Log out from all devices</button></div>
            </div>
          </div>
        ) : null}

        {active === "financial" ? (
          <div className={styles.stack}>
            <form className={styles.form} onSubmit={saveBaseCurrency}>
              <div className={styles.cardHeading}>
                <WalletCards size={19} />
                <div>
                  <h3>Base currency</h3>
                  <p>
                    Choose the currency you normally use. Your original financial records never change when you choose another base currency.
                  </p>
                </div>
              </div>

              <Select
                label="Base currency"
                value={baseCurrency}
                onChange={(value) =>
                  setBaseCurrency(normalizeCurrency(value))
                }
                options={currencyOptions}
              />

              <div className={styles.infoStrip}>
                <ShieldCheck size={18} />
                <div>
                  <strong>Original amounts stay unchanged</strong>
                  <span>
                    FICONTER now converts the reporting view into your selected base currency while preserving every original transaction amount and currency.
                  </span>
                </div>
              </div>

              <div className={styles.actions}>
                {localSaveFeedback("baseCurrency")}
                <button
                  className={styles.primaryButton}
                  disabled={loading}
                >
                  <Save size={16} />
                  Save base currency
                </button>
              </div>
            </form>

            {canUseFinancialPreferences ? (
              <form
                className={styles.form}
                onSubmit={(event) => {
                  event.preventDefault();
                  void savePreferences(
                    preferences,
                    "Financial preferences saved.",
                    "financialPreferences",
                  );
                }}
              >
                <div className={styles.formGrid}>
                  <Select
                    label="Number format"
                    value={preferences.numberFormat}
                    onChange={(value) =>
                      setPreferences((current) => ({
                        ...current,
                        numberFormat: value,
                      }))
                    }
                    options={[
                      ["de-DE", "1.234,56"],
                      ["en-US", "1,234.56"],
                      ["fr-FR", "1 234,56"],
                    ]}
                  />
                  <Select
                    label="Date format"
                    value={preferences.dateFormat}
                    onChange={(value) =>
                      setPreferences((current) => ({
                        ...current,
                        dateFormat: value,
                      }))
                    }
                    options={[
                      ["DD/MM/YYYY", "DD/MM/YYYY"],
                      ["MM/DD/YYYY", "MM/DD/YYYY"],
                      ["YYYY-MM-DD", "YYYY-MM-DD"],
                    ]}
                  />
                  <Select
                    label="First day of the week"
                    value={preferences.weekStart}
                    onChange={(value) =>
                      setPreferences((current) => ({
                        ...current,
                        weekStart: value,
                      }))
                    }
                    options={[
                      ["monday", "Monday"],
                      ["sunday", "Sunday"],
                    ]}
                  />
                </div>
                <Select
                  label="Monthly planner start balance behavior"
                  value={preferences.plannerStartBalance}
                  onChange={(value) =>
                    setPreferences((current) => ({
                      ...current,
                      plannerStartBalance: value,
                    }))
                  }
                  options={[
                    ["manual", "Manual entry"],
                    [
                      "carry-forward",
                      "Carry forward the previous month’s remaining balance",
                    ],
                    ["zero", "Start every new month at €0"],
                  ]}
                />
                <div className={styles.actions}>
                  {localSaveFeedback("financialPreferences")}
                  <button
                    className={styles.primaryButton}
                    disabled={loading}
                  >
                    <Save size={16} />
                    Save preferences
                  </button>
                </div>
              </form>
            ) : (
              <SubscriptionInlineLock feature="financial_preferences" />
            )}
          </div>
        ) : null}

        {active === "notifications" ? (
          canUseNotifications ? (
          <div className={styles.stack}>
            <div className={styles.formCard}><div className={styles.cardHeading}><Bell size={19} /><div><h3>Notification preferences</h3><p>These preferences are stored on your account and ready for Ficonter notification delivery.</p></div></div>
              <Toggle checked={preferences.notifications.emailEnabled} onChange={(value) => setPreferences((current) => ({ ...current, notifications: { ...current.notifications, emailEnabled: value } }))} label="Email notifications" />
              <Toggle checked={preferences.notifications.billReminders} onChange={(value) => setPreferences((current) => ({ ...current, notifications: { ...current.notifications, billReminders: value } }))} label="Bill reminders" disabled={!preferences.notifications.emailEnabled} />
              <Toggle checked={preferences.notifications.upcomingPayments} onChange={(value) => setPreferences((current) => ({ ...current, notifications: { ...current.notifications, upcomingPayments: value } }))} label="Upcoming payment alerts" disabled={!preferences.notifications.emailEnabled} />
              <Toggle checked={preferences.notifications.goalProgress} onChange={(value) => setPreferences((current) => ({ ...current, notifications: { ...current.notifications, goalProgress: value } }))} label="Goal progress alerts" disabled={!preferences.notifications.emailEnabled} />
              <Toggle checked={preferences.notifications.monthlySummary} onChange={(value) => setPreferences((current) => ({ ...current, notifications: { ...current.notifications, monthlySummary: value } }))} label="Monthly financial summary" disabled={!preferences.notifications.emailEnabled} />
              <div className={styles.actions}>{localSaveFeedback("notifications")}<button type="button" className={styles.primaryButton} disabled={loading} onClick={() => void savePreferences(preferences, "Notification preferences saved.", "notifications")}><Save size={16} />Save notifications</button></div>
            </div>
          </div>
          ) : (
            <SubscriptionInlineLock feature="automatic_bill_reminders" />
          )
        ) : null}

        {active === "appearance" ? (
          <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void savePreferences(preferences, "Appearance preferences saved.", "appearance"); }}>
            <fieldset className={styles.optionGroup}>
              <legend>Theme</legend>
              <p className={styles.themeHelp}>
                Choose the atmosphere that feels most comfortable. Every theme uses
                high-contrast text and controls for reliable readability. Theme colours and typography preview instantly; Save appearance is only required to keep the change.
              </p>
              <div className={styles.optionGrid}>
                {INTERFACE_THEME_OPTIONS.map(({ value, label, description }) => {
                  const isLockedTheme =
                    !canUseAppearanceThemes &&
                    !FREE_APPEARANCE_THEME_VALUES.has(value);

                  return (
                    <label
                      className={styles.optionCard}
                      key={value}
                      aria-disabled={isLockedTheme}
                      style={
                        isLockedTheme
                          ? { opacity: 0.55, cursor: "not-allowed" }
                          : undefined
                      }
                    >
                      <input
                        type="radio"
                        checked={preferences.appearance === value}
                        disabled={isLockedTheme}
                        onChange={() => {
                          if (isLockedTheme) return;
                          const next = { ...preferences, appearance: value };
                          // Apply the root theme attributes synchronously inside the
                          // click handler. The palette and typography therefore switch
                          // together before any network request or page refresh.
                          applyInterfacePreview(next);
                          setPreferences(next);
                        }}
                      />
                      <span
                        className={styles.optionPreview}
                        data-theme={value}
                        aria-hidden="true"
                      />
                      <strong>{label}</strong>
                      <small>
                        {description}
                        {isLockedTheme ? " · Personal Pro" : ""}
                      </small>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {canManageWallpapers ? (
              <fieldset className={styles.optionGroup} data-owner-wallpaper-controls="true">
                <legend>Smart time-of-day wallpaper</legend>
                {canUseTimeBasedWallpapers ? (
                  <>
                    <p className={styles.themeHelp}>
                      Your local device time keeps the greeting and real coastal photograph
                      synchronized automatically. The image changes at 12:00 and 18:00.
                    </p>
                    <div className={styles.wallpaperGrid}>
                      {DAYPART_WALLPAPER_SCHEDULE.map(({ value, label, hours, description }) => (
                        <article className={styles.wallpaperScheduleCard} key={value}>
                          <span
                            className={styles.wallpaperPreview}
                            data-daypart={value}
                            aria-hidden="true"
                          >
                            <i />
                          </span>
                          <strong>{label}</strong>
                          <small>{hours} · {description}</small>
                        </article>
                      ))}
                    </div>
                    <div className={styles.infoStrip}>
                      <Palette size={18} />
                      <div>
                        <strong>Automatic day cycle is active</strong>
                        <span>Owner / Super Admin only · shared by Personal and Business workspaces.</span>
                      </div>
                    </div>
                  </>
                ) : null}
              </fieldset>
            ) : null}
            <fieldset className={styles.optionGroup}>
              <legend>Surface opacity</legend>
              <p className={styles.themeHelp}>
                Adjust how transparent cards, bars, banners, panels and drawers appear. Text, numbers, icons and logos remain fully opaque. The change stays a preview until you click Save appearance.
              </p>
              <div className={styles.opacityControl}>
                <div className={styles.opacityHeader}>
                  <span>Surface opacity</span>
                  <output aria-live="polite">{preferences.surfaceOpacity}%</output>
                </div>
                <input
                  className={styles.opacityRange}
                  type="range"
                  min="55"
                  max="100"
                  step="5"
                  value={preferences.surfaceOpacity}
                  aria-label="Surface opacity"
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      surfaceOpacity: normalizeSurfaceOpacity(event.target.value),
                    }))
                  }
                />
                <div
                  className={styles.opacityPreview}
                  style={{
                    backgroundColor: `color-mix(in srgb, var(--surface-raised-solid, #ffffff) ${preferences.surfaceOpacity}%, transparent)`,
                  }}
                >
                  <strong>Surface preview</strong>
                  <small>Cards · bars · banners · panels · drawers</small>
                </div>
              </div>
            </fieldset>
            <fieldset className={styles.optionGroup}>
              <legend>Layout density</legend>
              <div className={styles.densityGrid}>
                {([
                  ["comfortable", "Comfortable", "Larger cards, wider spacing and bigger controls for a calmer view."],
                  ["compact", "Compact", "Much tighter cards, rows and spacing so substantially more information fits on screen."],
                ] as const).map(([value, label, description]) => (
                  <label className={styles.densityCard} key={value}>
                    <input
                      type="radio"
                      checked={preferences.density === value}
                      onChange={() => {
                        const next = { ...preferences, density: value };
                        setPreferences(next);
                      }}
                    />
                    <span className={styles.densityPreview} data-density={value} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className={styles.actions}>{localSaveFeedback("appearance")}<button className={styles.primaryButton} disabled={loading}><Save size={16} />Save appearance</button></div>
          </form>
        ) : null}

        {active === "privacy" ? (
          <div className={styles.stack}>
            <ActionCard icon={ReceiptText} title="Export transaction history" description="Download your complete transaction ledger in spreadsheet-ready CSV format." button={exporting === "transactions" ? "Preparing CSV…" : "Download CSV"} onClick={exportTransactions} disabled={loading || exporting !== null} />
            <ExportFormatCard
              disabled={loading || exporting !== null}
              exporting={exporting}
              onJson={exportAccountJson}
              onPdf={exportAccountPdf}
              pdfLocked={!canUsePrivatePdfExport}
              onUpgrade={() => {
                window.location.assign(
                  "/dashboard/settings?section=subscription&required=private_pdf_export",
                );
              }}
            />
            <div className={styles.infoGrid}><button type="button" onClick={() => setDialog("privacy")}><ShieldCheck size={18} /><span><strong>Privacy information</strong><small>How Ficonter handles your records</small></span><ChevronRight size={16} /></button><button type="button" onClick={() => setDialog("retention")}><FileText size={18} /><span><strong>Data retention</strong><small>When records remain or are removed</small></span><ChevronRight size={16} /></button></div>
            <div className={styles.dangerZone}><div><span className={styles.eyebrow}>Danger zone</span><h3>Permanent data controls</h3><p>These actions require a custom confirmation and cannot be undone.</p></div><div className={styles.dangerActions}><button type="button" className={styles.dangerOutline} onClick={() => { setDialog("delete-records"); setConfirmation(""); }}><Trash2 size={16} />Delete financial records</button><button type="button" className={styles.dangerButton} onClick={() => { setDialog("delete-account"); setConfirmation(""); }}><Trash2 size={16} />Delete account</button></div></div>
          </div>
        ) : null}

        {!isSubscriptionExempt && active === "subscription" ? (
          <div className={styles.stack}>
            {requiredFeature &&
            requiredFeatureDefinition &&
            requiredPlan &&
            !requiredFeatureAlreadyAvailable ? (
              <div className={styles.formCard}>
                <div className={styles.cardHeading}>
                  <LockKeyhole size={19} />
                  <div>
                    <span className={styles.eyebrow}>Upgrade required</span>
                    <h3>Unlock {requiredFeatureDefinition.label}</h3>
                    <p>
                      {requiredPlan.shortName} is required for this feature.
                      Upgrade below to unlock it immediately after PayPal confirms the subscription.
                    </p>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() =>
                      document
                        .getElementById("subscription-plans")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                  >
                    Choose {requiredPlan.shortName}
                  </button>
                </div>
              </div>
            ) : null}

            <div className={styles.subscriptionCurrentCard}>
              <div>
                <span className={styles.eyebrow}>Current plan</span>
                <h3>{currentPlan.name}</h3>
                <p>{currentPlan.description}</p>
                {currentPlanCode === "beta" ? (
                  <small className={styles.betaNotice}>
                    Private Beta: full Personal Pro + Business Pro access for €0. No payment method is required.
                  </small>
                ) : null}
              </div>
              <div className={styles.subscriptionCurrentMeta}>
                <span className={styles.defaultBadge}>{subscriptionStatusLabel}</span>
                <small>{subscription?.provider === "paypal" ? "PayPal" : currentPlanCode === "beta" ? "Private Beta access" : "Ficonter account"}</small>
              </div>
            </div>

            {showSubscriptionManagement ? (
              <div className={styles.formCard}>
                <div className={styles.cardHeading}>
                  <CreditCard size={19} />
                  <div>
                    <h3>Manage subscription</h3>
                    <p>
                      {subscription?.cancel_at_period_end === true
                        ? cancellationPaidThrough && subscriptionEndLabel
                          ? `Your plan will not renew. Paid access remains active until ${subscriptionEndLabel}.`
                          : "Your plan will not renew."
                        : subscriptionEndLabel
                          ? `Your ${subscription?.billing_interval === "annual" ? "annual" : "monthly"} PayPal subscription is active. Next billing date: ${subscriptionEndLabel}.`
                          : `Your ${subscription?.billing_interval === "annual" ? "annual" : "monthly"} PayPal subscription is active.`}
                    </p>
                  </div>
                </div>

                <div className={styles.cardActions}>
                  {subscription?.cancel_at_period_end === true ? (
                    <span className={styles.currentBadge}>
                      Cancellation scheduled
                    </span>
                  ) : canCancelSubscription ? (
                    <button
                      type="button"
                      className={styles.dangerOutline}
                      onClick={() => setDialog("cancel-subscription")}
                    >
                      Cancel subscription
                    </button>
                  ) : (
                    <span className={styles.currentBadge}>
                      {subscriptionStatusLabel}
                    </span>
                  )}
                </div>
              </div>
            ) : null}

            {showSubscriptionManagement ? (
              <div className={styles.formCard}>
                <div className={styles.cardHeading}>
                  <WalletCards size={19} />
                  <div>
                    <h3>Billing settings</h3>
                    <p>
                      Review the billing details currently attached to your Ficonter subscription.
                    </p>
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <label>
                    <span>Plan</span>
                    <input value={currentPlan.name} disabled />
                  </label>
                  <label>
                    <span>Billing cycle</span>
                    <input
                      value={
                        subscription?.billing_interval === "annual"
                          ? "Annual"
                          : "Monthly"
                      }
                      disabled
                    />
                  </label>
                  <label>
                    <span>Payment provider</span>
                    <input value="PayPal" disabled />
                  </label>
                  <label>
                    <span>
                      {subscription?.cancel_at_period_end === true
                        ? "Paid access until"
                        : "Next billing date"}
                    </span>
                    <input
                      value={
                        subscriptionEndLabel ||
                        (subscription?.cancel_at_period_end === true
                          ? "Cancellation scheduled"
                          : "Pending from PayPal")
                      }
                      disabled
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {showSubscriptionManagement ? (
              <div className={styles.formCard}>
                <div className={styles.cardHeading}>
                  <ReceiptText size={19} />
                  <div>
                    <h3>Billing history & invoices</h3>
                    <p>
                      View subscription payments verified directly with PayPal and download a PDF receipt for each payment.
                    </p>
                  </div>
                </div>

                {billingHistoryLoading ? (
                  <div className={styles.infoStrip}>
                    <ReceiptText size={18} />
                    <div>
                      <strong>Loading billing history…</strong>
                      <span>Ficonter is securely checking PayPal.</span>
                    </div>
                  </div>
                ) : billingHistoryError ? (
                  <div className={styles.infoStrip}>
                    <ReceiptText size={18} />
                    <div>
                      <strong>Billing history unavailable</strong>
                      <span>{billingHistoryError}</span>
                    </div>
                  </div>
                ) : billingHistory.length === 0 ? (
                  <div className={styles.infoStrip}>
                    <ReceiptText size={18} />
                    <div>
                      <strong>No completed billing transactions yet</strong>
                      <span>
                        New PayPal subscription payments will appear here automatically.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.stack}>
                    {billingHistory.map((transaction) => {
                      const paymentDate = formatSubscriptionDate(
                        transaction.time,
                      );

                      return (
                        <div className={styles.sessionRow} key={transaction.id}>
                          <span className={styles.sessionIcon}>
                            <ReceiptText size={17} />
                          </span>
                          <div>
                            <strong>
                              {formatBillingAmount(
                                transaction.amount.currency,
                                transaction.amount.value,
                              )}
                              {paymentDate ? ` · ${paymentDate}` : ""}
                            </strong>
                            <small>
                              {transaction.status.replaceAll("_", " ")} · PayPal transaction {transaction.id}
                            </small>
                          </div>
                          <a
                            className={styles.textLink}
                            href={`/api/paypal/invoice/${encodeURIComponent(
                              transaction.id,
                            )}`}
                          >
                            Download PDF
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={billingHistoryLoading}
                    onClick={() =>
                      setBillingHistoryReloadKey((value) => value + 1)
                    }
                  >
                    {billingHistoryLoading ? "Refreshing…" : "Refresh history"}
                  </button>
                </div>

                <small className={styles.betaNotice}>
                  Sandbox downloads are marked as test payment receipts. A production tax invoice requires Ficonter legal seller and tax details before live billing is enabled.
                </small>
              </div>
            ) : null}

            {currentPlanCode !== "beta" ? (
              <div className={styles.formCard}>
                <div className={styles.cardHeading}>
                  <KeyRound size={19} />
                  <div>
                    <h3>Private Beta invitation</h3>
                    <p>
                      Already registered? Enter a valid invitation code to activate Beta access for this account.
                    </p>
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <label>
                    <span>Beta invitation code</span>
                    <input
                      type="password"
                      value={betaActivationCode}
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Enter private invitation code"
                      onChange={(event) =>
                        setBetaActivationCode(event.target.value)
                      }
                    />
                  </label>
                </div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={betaActivating || !betaActivationCode.trim()}
                    onClick={() => void activateExistingBetaAccess()}
                  >
                    <KeyRound size={16} />
                    {betaActivating ? "Validating…" : "Activate Beta access"}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.formCard}>
                <div className={styles.cardHeading}>
                  <Check size={19} />
                  <div>
                    <h3>Beta invitation verified</h3>
                    <p>
                      This account already has verified Beta access. No invitation code needs to be entered again while Beta access remains active.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.subscriptionIntro}>
              <div>
                <span className={styles.eyebrow}>Plan separation</span>
                <h3>Choose the level of Ficonter that fits the customer</h3>
                <p>
                  Compare the available plans and choose monthly or annual billing.
                </p>
              </div>
              <div className={styles.billingPreviewToggle} aria-label="Preview billing interval">
                <button type="button" className={subscriptionPreviewInterval === "monthly" ? styles.billingPreviewActive : ""} onClick={() => setSubscriptionPreviewInterval("monthly")}>Monthly</button>
                <button type="button" className={subscriptionPreviewInterval === "annual" ? styles.billingPreviewActive : ""} onClick={() => setSubscriptionPreviewInterval("annual")}>Annual</button>
              </div>
            </div>

            <div className={styles.subscriptionPlanGrid} id="subscription-plans">
              {PUBLIC_SUBSCRIPTION_PLANS.map((plan) => {
                const annual = subscriptionPreviewInterval === "annual";
                const price = annual ? plan.annualPriceEur : plan.monthlyPriceEur;
                const isCurrent = effectivePlanCode === plan.code;
                const highlights =
                  plan.code === "free"
                    ? ["Overview, transactions & bills", "Monthly planner", "CSV & JSON exports"]
                    : plan.code === "personal_pro"
                      ? ["Everything in Free", "Savings, debt, cards, goals & net worth", "Financial intelligence, GPS & PDF exports"]
                      : ["Everything in Personal Pro", "Complete Business workspace", "Sales, inventory, costs and reports"];

                return (
                  <article key={plan.code} className={`${styles.subscriptionPlanCard}${plan.code === "personal_pro" ? ` ${styles.subscriptionPlanFeatured}` : ""}`}>
                    <div className={styles.subscriptionPlanHeading}>
                      <div>
                        <span className={styles.eyebrow}>{plan.code === "personal_pro" ? "Recommended" : "Plan"}</span>
                        <h3>{plan.shortName}</h3>
                      </div>
                      {isCurrent ? <span className={styles.currentBadge}>Current</span> : null}
                    </div>
                    <div className={styles.subscriptionPrice}>
                      <strong>€{Number(price ?? 0).toFixed(price === 0 ? 0 : 2)}</strong>
                      <span>{price === 0 ? "forever" : annual ? "/ year" : "/ month"}</span>
                    </div>
                    <p>{plan.description}</p>
                    <ul className={styles.subscriptionFeatureList}>
                      {highlights.map((highlight) => (
                        <li key={highlight}><Check size={15} /> <span>{highlight}</span></li>
                      ))}
                    </ul>
                    {plan.code === "personal_pro" && annual ? <small className={styles.subscriptionSaving}>Save €10.88 compared with monthly billing.</small> : null}
                    {plan.code === "business_pro" && annual ? <small className={styles.subscriptionSaving}>Save €20.88 compared with monthly billing.</small> : null}
                   {isCurrent ? (
  <button
    type="button"
    className={styles.subscriptionDisabledButton}
    disabled
  >
    Current plan
  </button>
) : plan.code === "personal_pro" || plan.code === "business_pro" ? (
  <PayPalSubscriptionCheckout
    planCode={plan.code}
    billingInterval={annual ? "annual" : "monthly"}
  />
) : (
  <button
    type="button"
    className={styles.subscriptionDisabledButton}
    disabled
  >
    Free plan
  </button>
)}
                  </article>
                );
              })}
            </div>


          </div>
        ) : null}

      </main>

      {dialog ? <Modal title={dialog === "cancel-subscription" ? "Cancel your subscription?" : dialog === "delete-records" ? "Delete financial records?" : dialog === "delete-account" ? "Delete your Ficonter account?" : dialog === "privacy" ? "Privacy information" : "Data retention information"} onClose={() => { if (!loading) { setDialog(null); setConfirmation(""); } }}>
        {dialog === "cancel-subscription" ? (
          <div className={styles.modalCopy}>
            <p>
              Future renewal will stop. Your Ficonter account and financial
              data will not be deleted.
            </p>
            <p>
              {subscriptionEndLabel
                ? `You will keep your paid plan access until ${subscriptionEndLabel}.`
                : "Ficonter will verify your paid-through date before the cancellation is completed."}
            </p>
            <div className={styles.cardActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={subscriptionCanceling}
                onClick={() => setDialog(null)}
              >
                Keep subscription
              </button>
              <button
                type="button"
                data-enter-confirm="true"
                className={styles.dangerButton}
                disabled={subscriptionCanceling}
                onClick={() => void cancelSubscription()}
              >
                {subscriptionCanceling
                  ? "Canceling…"
                  : "Confirm cancellation"}
              </button>
            </div>
          </div>
        ) : null}
        {dialog === "privacy" ? <div className={styles.modalCopy}><p>Ficonter stores the profile and financial records required to provide your private finance workspace. Account preferences are stored in your authenticated user metadata. Financial data is protected by Supabase row-level access controls.</p><p>Ficonter does not become a bank, move funds or provide credit decisions.</p></div> : null}
        {dialog === "retention" ? <div className={styles.modalCopy}><p>Your records remain available while your account is active. You may export them at any time. Deleting financial records removes the selected financial tables while preserving your login. Deleting your account removes the account and associated data permanently.</p></div> : null}
        {dialog === "delete-records" ? <div className={styles.modalCopy}><p>This removes transactions, bills, goals, debt and credit-card records, and monthly planner records. Your login and profile remain active.</p><label>Type <strong>DELETE RECORDS</strong><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button type="button" data-enter-confirm="true" className={styles.dangerButton} disabled={confirmation !== "DELETE RECORDS" || loading} onClick={deleteFinancialRecords}>{loading ? "Deleting…" : "Delete financial records"}</button></div> : null}
        {dialog === "delete-account" ? <div className={styles.modalCopy}><p>This permanently removes your Ficonter account and all associated records. This action cannot be undone.</p><label>Type <strong>DELETE ACCOUNT</strong><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button type="button" data-enter-confirm="true" className={styles.dangerButton} disabled={confirmation !== "DELETE ACCOUNT" || loading} onClick={deleteAccount}>{loading ? "Deleting…" : "Delete account permanently"}</button></div> : null}
      </Modal> : null}
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (value: boolean) => void | Promise<void>; label: string; disabled?: boolean }) {
  return <label className={`${styles.toggleRow}${disabled ? ` ${styles.toggleDisabled}` : ""}`}><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => void onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string,string][] }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function ActionCard({ icon: Icon, title, description, button, onClick, disabled }: { icon: typeof Download; title: string; description: string; button: string; onClick: () => void | Promise<void>; disabled: boolean }) {
  return <div className={styles.privacyCard}><div className={styles.cardHeading}><Icon size={19} /><div><h3>{title}</h3><p>{description}</p></div></div><button type="button" className={styles.secondaryButton} onClick={() => void onClick()} disabled={disabled}><Download size={16} />{button}</button></div>;
}


function ExportFormatCard({
  disabled,
  exporting,
  onJson,
  onPdf,
  pdfLocked = false,
  onUpgrade,
}: {
  disabled: boolean;
  exporting: ExportKind;
  onJson: () => void | Promise<void>;
  onPdf: () => void | Promise<void>;
  pdfLocked?: boolean;
  onUpgrade?: () => void;
}) {
  return (
    <div className={styles.privacyCard}>
      <div className={styles.cardHeading}>
        <Download size={19} />
        <div>
          <h3>Export complete account data</h3>
          <p>Keep a machine-readable JSON archive or download a polished private financial report as PDF.</p>
        </div>
      </div>
      <div className={styles.exportActions}>
        <button type="button" className={styles.secondaryButton} onClick={() => void onJson()} disabled={disabled}>
          <FileJson size={16} />{exporting === "json" ? "Preparing JSON…" : "Download JSON"}
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            if (pdfLocked) {
              onUpgrade?.();
              return;
            }
            void onPdf();
          }}
          disabled={disabled}
          title={pdfLocked ? "Personal Pro required" : undefined}
        >
          {pdfLocked ? <LockKeyhole size={16} /> : <FileType2 size={16} />}
          {pdfLocked
            ? "PDF · Personal Pro"
            : exporting === "pdf"
              ? "Building PDF…"
              : "Download PDF"}
        </button>
      </div>
    </div>
  );
}

function SubscriptionInlineLock({
  feature,
  compact = false,
}: {
  feature: SubscriptionFeature;
  compact?: boolean;
}) {
  const definition = getSubscriptionFeatureDefinition(feature);
  const requiredCode = getRequiredSubscriptionPlan(feature);
  const requiredPlan = requiredCode ? SUBSCRIPTION_PLANS[requiredCode] : null;

  return (
    <div className={compact ? styles.infoStrip : styles.formCard}>
      <LockKeyhole size={18} />
      <div>
        <strong>
          {definition.label} · {requiredPlan?.shortName ?? "Upgrade required"}
        </strong>
        <span>
          Upgrade to {requiredPlan?.shortName ?? "the required plan"} to use this setting.
        </span>
      </div>
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() =>
          window.location.assign(
            `/dashboard/settings?section=subscription&required=${encodeURIComponent(feature)}`,
          )
        }
      >
        Upgrade
      </button>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className={styles.backdrop} onMouseDown={onClose}><div className={styles.modal} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className={styles.close} type="button" onClick={onClose}><X size={18} /></button><span className={styles.eyebrow}>Ficonter settings</span><h2>{title}</h2>{children}</div></div>;
}
