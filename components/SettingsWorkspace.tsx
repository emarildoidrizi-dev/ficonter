"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
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
  Globe2,
  KeyRound,
  Languages,
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
  resolveAppearance,
  type AppearancePreference,
} from "@/lib/interfaceThemes";
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
  | "subscription"
  | "language";

type Preferences = {
  currency: string;
  numberFormat: string;
  dateFormat: string;
  weekStart: string;
  plannerStartBalance: string;
  density: "comfortable" | "compact";
  appearance: AppearancePreference;
  language: "en";
  notifications: {
    billReminders: boolean;
    upcomingPayments: boolean;
    goalProgress: boolean;
    monthlySummary: boolean;
    emailEnabled: boolean;
  };
};

type Props = {
  userId: string;
  email: string;
  metadata: Metadata;
  initialSection?: string;
};

type DialogState = null | "delete-records" | "delete-account" | "privacy" | "retention";
type ExportKind = null | "transactions" | "json" | "pdf";

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
        "language",
      ].includes(value),
  );
}

const sections = [
  { id: "profile", label: "Profile", description: "Identity and profile photo", icon: UserRound },
  { id: "security", label: "Account & security", description: "Login, password and sessions", icon: LockKeyhole },
  { id: "financial", label: "Financial preferences", description: "Currency, formats and planner", icon: WalletCards },
  { id: "notifications", label: "Notifications", description: "Reminders and summaries", icon: Bell },
  { id: "appearance", label: "Appearance", description: "Theme and layout density", icon: Palette },
  { id: "privacy", label: "Data & privacy", description: "Exports and account controls", icon: Database },
  { id: "subscription", label: "Subscription", description: "Plan and billing", icon: CreditCard },
  { id: "language", label: "Language", description: "English by default", icon: Globe2 },
] as const;

const defaultPreferences: Preferences = {
  currency: "EUR",
  numberFormat: "de-DE",
  dateFormat: "DD/MM/YYYY",
  weekStart: "monday",
  plannerStartBalance: "manual",
  density: "comfortable",
  appearance: "light",
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
  const stored =
    metadata.ficonter_preferences &&
    typeof metadata.ficonter_preferences === "object"
      ? (metadata.ficonter_preferences as Partial<Preferences>)
      : {};

  return {
    ...defaultPreferences,
    ...stored,
    appearance: normalizeAppearance(
      typeof stored.appearance === "string" ? stored.appearance : undefined,
    ),
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

function applyInterface(preferences: Preferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = resolveAppearance(preferences.appearance, prefersDark);

  root.dataset.theme = preferences.appearance;
  root.dataset.resolvedTheme = resolvedTheme;
  root.dataset.density = preferences.density;
  root.style.colorScheme = resolvedTheme;

  try {
    localStorage.setItem("ficonter-appearance", preferences.appearance);
    localStorage.setItem("ficonter-density", preferences.density);
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

export function SettingsWorkspace({ userId, email, metadata, initialSection }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const photoInput = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<SectionId>(() =>
    isSectionId(initialSection) ? initialSection : "profile",
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
  const [rememberDevice, setRememberDevice] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<ExportKind>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (isSectionId(initialSection)) {
      setActive(initialSection);
      setMessage(null);
    }
  }, [initialSection]);

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
    applyInterface(preferences);
  }, []);

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

      showSuccess("Profile changes saved.");
    } catch (error) {
      showError(error, "Your profile could not be updated.");
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

  async function savePreferences(next: Preferences, text: string) {
    setLoading(true);
    setMessage(null);
    try {
      await saveMetadata({ ficonter_preferences: next });
      setPreferences(next);
      applyInterface(next);
      window.dispatchEvent(new CustomEvent("ficonter:preferences-updated", { detail: next }));
      showSuccess(text);
    } catch (error) {
      showError(error, "Your preferences could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function saveRememberDevice(enabled: boolean) {
    setRememberDevice(enabled);
    saveTrustedDevicePreference(enabled);
    showSuccess(enabled ? "This device will keep you signed in." : "Persistent login was disabled for this device.");
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
    const userScopedTables: AccountExportTable[] = [
      "transactions",
      "bills",
      "goals",
      "goal_investments",
      "debts",
      "debt_payments",
      "monthly_budget_plans",
      "monthly_budget_items",
      "financial_documents",
      "support_requests",
      "user_notifications",
    ];

    const results = await Promise.all(
      userScopedTables.map(async (table) => {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("user_id", userId);
        if (error) throw error;
        return [table, (data ?? []) as Record<string, unknown>[]] as const;
      }),
    );

    const { data: supportMessages, error: supportMessagesError } = await supabase
      .from("support_messages")
      .select("*");
    if (supportMessagesError) throw supportMessagesError;
    results.push([
      "support_messages",
      (supportMessages ?? []) as Record<string, unknown>[],
    ]);

    return {
      schema_version: "1.2",
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
        "All transactions, bills, goals, debts and planner records were deleted. Your account remains active.",
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

  const activeSection = sections.find((section) => section.id === active)!;
  const avatarText = (displayName || fullName || email || "F").trim().slice(0, 1).toUpperCase();

  return (
    <div className={styles.workspace}>
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
          {sections.map(({ id, label, description, icon: Icon }) => (
            <button key={id} type="button" className={`${styles.sectionButton}${active === id ? ` ${styles.sectionActive}` : ""}`} onClick={() => { setActive(id); setMessage(null); }}>
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
              <div className={styles.actions}><button className={styles.primaryButton} disabled={loading}><Save size={16} />{loading ? "Saving…" : "Save profile"}</button></div>
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
              <Toggle checked={rememberDevice} onChange={saveRememberDevice} label="Persistent login on this device" />
            </div>
            <div className={styles.formCard}>
              <div className={styles.cardHeading}><Monitor size={19} /><div><h3>Active sessions</h3><p>Supabase exposes the current browser session to the app. Other sessions can be revoked securely.</p></div></div>
              <div className={styles.sessionRow}><span className={styles.sessionIcon}><Monitor size={17} /></span><div><strong>{currentDeviceLabel()}</strong><small>Current session · active now</small></div><span className={styles.currentBadge}>Current</span></div>
              <div className={styles.cardActions}><button type="button" className={styles.secondaryButton} onClick={signOutOtherSessions} disabled={loading}>Sign out other sessions</button><button type="button" className={styles.dangerOutline} onClick={signOutEverywhere} disabled={loading}><LogOut size={16} />Log out from all devices</button></div>
            </div>
          </div>
        ) : null}

        {active === "financial" ? (
          <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void savePreferences(preferences, "Financial preferences saved."); }}>
            <div className={styles.formGrid}>
              <Select label="Default currency" value={preferences.currency} onChange={(value) => setPreferences((current) => ({ ...current, currency: value }))} options={[['EUR','EUR — Euro'],['USD','USD — US Dollar'],['GBP','GBP — British Pound'],['CHF','CHF — Swiss Franc'],['ALL','ALL — Albanian Lek']]} />
              <Select label="Number format" value={preferences.numberFormat} onChange={(value) => setPreferences((current) => ({ ...current, numberFormat: value }))} options={[['de-DE','1.234,56'],['en-US','1,234.56'],['fr-FR','1 234,56']]} />
              <Select label="Date format" value={preferences.dateFormat} onChange={(value) => setPreferences((current) => ({ ...current, dateFormat: value }))} options={[['DD/MM/YYYY','DD/MM/YYYY'],['MM/DD/YYYY','MM/DD/YYYY'],['YYYY-MM-DD','YYYY-MM-DD']]} />
              <Select label="First day of the week" value={preferences.weekStart} onChange={(value) => setPreferences((current) => ({ ...current, weekStart: value }))} options={[['monday','Monday'],['sunday','Sunday']]} />
            </div>
            <Select label="Monthly planner start balance behavior" value={preferences.plannerStartBalance} onChange={(value) => setPreferences((current) => ({ ...current, plannerStartBalance: value }))} options={[['manual','Manual entry'],['carry-forward','Carry forward the previous month’s remaining balance'],['zero','Start every new month at €0']]} />
            <div className={styles.infoStrip}><LayoutTemplate size={18} /><div><strong>EUR remains the calculation currency</strong><span>Original currencies and historical exchange rates remain preserved.</span></div></div>
            <div className={styles.actions}><button className={styles.primaryButton} disabled={loading}><Save size={16} />Save preferences</button></div>
          </form>
        ) : null}

        {active === "notifications" ? (
          <div className={styles.stack}>
            <div className={styles.formCard}><div className={styles.cardHeading}><Bell size={19} /><div><h3>Notification preferences</h3><p>These preferences are stored on your account and ready for Ficonter notification delivery.</p></div></div>
              <Toggle checked={preferences.notifications.emailEnabled} onChange={(value) => setPreferences((current) => ({ ...current, notifications: { ...current.notifications, emailEnabled: value } }))} label="Email notifications" />
              <Toggle checked={preferences.notifications.billReminders} onChange={(value) => setPreferences((current) => ({ ...current, notifications: { ...current.notifications, billReminders: value } }))} label="Bill reminders" disabled={!preferences.notifications.emailEnabled} />
              <Toggle checked={preferences.notifications.upcomingPayments} onChange={(value) => setPreferences((current) => ({ ...current, notifications: { ...current.notifications, upcomingPayments: value } }))} label="Upcoming payment alerts" disabled={!preferences.notifications.emailEnabled} />
              <Toggle checked={preferences.notifications.goalProgress} onChange={(value) => setPreferences((current) => ({ ...current, notifications: { ...current.notifications, goalProgress: value } }))} label="Goal progress alerts" disabled={!preferences.notifications.emailEnabled} />
              <Toggle checked={preferences.notifications.monthlySummary} onChange={(value) => setPreferences((current) => ({ ...current, notifications: { ...current.notifications, monthlySummary: value } }))} label="Monthly financial summary" disabled={!preferences.notifications.emailEnabled} />
              <div className={styles.actions}><button type="button" className={styles.primaryButton} disabled={loading} onClick={() => void savePreferences(preferences, "Notification preferences saved.")}><Save size={16} />Save notifications</button></div>
            </div>
          </div>
        ) : null}

        {active === "appearance" ? (
          <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void savePreferences(preferences, "Appearance preferences saved."); }}>
            <fieldset className={styles.optionGroup}>
              <legend>Theme</legend>
              <p className={styles.themeHelp}>
                Choose the atmosphere that feels most comfortable. Every theme uses
                high-contrast text and controls for reliable readability.
              </p>
              <div className={styles.optionGrid}>
                {INTERFACE_THEME_OPTIONS.map(({ value, label, description }) => (
                  <label className={styles.optionCard} key={value}>
                    <input
                      type="radio"
                      checked={preferences.appearance === value}
                      onChange={() => {
                        const next = { ...preferences, appearance: value };
                        setPreferences(next);
                        applyInterface(next);
                      }}
                    />
                    <span
                      className={styles.optionPreview}
                      data-theme={value}
                      aria-hidden="true"
                    />
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className={styles.optionGroup}>
              <legend>Layout density</legend>
              <div className={styles.densityGrid}>
                {([
                  ["comfortable", "Comfortable", "More breathing room, larger controls and spacious cards."],
                  ["compact", "Compact", "Tighter spacing and more financial information visible at once."],
                ] as const).map(([value, label, description]) => (
                  <label className={styles.densityCard} key={value}>
                    <input
                      type="radio"
                      checked={preferences.density === value}
                      onChange={() => {
                        const next = { ...preferences, density: value };
                        setPreferences(next);
                        applyInterface(next);
                      }}
                    />
                    <span className={styles.densityPreview} data-density={value} aria-hidden="true">
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
            <div className={styles.actions}><button className={styles.primaryButton} disabled={loading}><Save size={16} />Save appearance</button></div>
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
            />
            <div className={styles.infoGrid}><button type="button" onClick={() => setDialog("privacy")}><ShieldCheck size={18} /><span><strong>Privacy information</strong><small>How Ficonter handles your records</small></span><ChevronRight size={16} /></button><button type="button" onClick={() => setDialog("retention")}><FileText size={18} /><span><strong>Data retention</strong><small>When records remain or are removed</small></span><ChevronRight size={16} /></button></div>
            <div className={styles.dangerZone}><div><span className={styles.eyebrow}>Danger zone</span><h3>Permanent data controls</h3><p>These actions require a custom confirmation and cannot be undone.</p></div><div className={styles.dangerActions}><button type="button" className={styles.dangerOutline} onClick={() => { setDialog("delete-records"); setConfirmation(""); }}><Trash2 size={16} />Delete financial records</button><button type="button" className={styles.dangerButton} onClick={() => { setDialog("delete-account"); setConfirmation(""); }}><Trash2 size={16} />Delete account</button></div></div>
          </div>
        ) : null}

        {active === "subscription" ? (
          <div className={styles.stack}>
            <div className={styles.planCard}><div><span className={styles.eyebrow}>Current plan</span><h3>Ficonter Preview</h3><p>Your account currently uses the development preview plan.</p></div><span className={styles.defaultBadge}>Active</span></div>
            <div className={styles.disabledGrid}>{['Billing cycle','Upgrade plan','Cancel subscription','Invoices'].map((label) => <div key={label}><CreditCard size={17} /><strong>{label}</strong><small>Available when paid subscriptions launch</small><button disabled>Coming soon</button></div>)}</div>
          </div>
        ) : null}

        {active === "language" ? (
          <div className={styles.languageCard}><span className={styles.languageIcon}><Languages size={25} /></span><div><h3>English — Default</h3><p>English is the standard language for every new Ficonter account. More languages will be added after the translation system is connected.</p></div><span className={styles.defaultBadge}>Disabled for now</span></div>
        ) : null}
      </main>

      {dialog ? <Modal title={dialog === "delete-records" ? "Delete financial records?" : dialog === "delete-account" ? "Delete your Ficonter account?" : dialog === "privacy" ? "Privacy information" : "Data retention information"} onClose={() => { if (!loading) { setDialog(null); setConfirmation(""); } }}>
        {dialog === "privacy" ? <div className={styles.modalCopy}><p>Ficonter stores the profile and financial records required to provide your private finance workspace. Account preferences are stored in your authenticated user metadata. Financial data is protected by Supabase row-level access controls.</p><p>Ficonter does not become a bank, move funds or provide credit decisions.</p></div> : null}
        {dialog === "retention" ? <div className={styles.modalCopy}><p>Your records remain available while your account is active. You may export them at any time. Deleting financial records removes the selected financial tables while preserving your login. Deleting your account removes the account and associated data permanently.</p></div> : null}
        {dialog === "delete-records" ? <div className={styles.modalCopy}><p>This removes transactions, bills, goals, debt records and monthly planner records. Your login and profile remain active.</p><label>Type <strong>DELETE RECORDS</strong><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button type="button" data-enter-confirm="true" className={styles.dangerButton} disabled={confirmation !== "DELETE RECORDS" || loading} onClick={deleteFinancialRecords}>{loading ? "Deleting…" : "Delete financial records"}</button></div> : null}
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
}: {
  disabled: boolean;
  exporting: ExportKind;
  onJson: () => void | Promise<void>;
  onPdf: () => void | Promise<void>;
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
        <button type="button" className={styles.primaryButton} onClick={() => void onPdf()} disabled={disabled}>
          <FileType2 size={16} />{exporting === "pdf" ? "Building PDF…" : "Download PDF"}
        </button>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className={styles.backdrop} onMouseDown={onClose}><div className={styles.modal} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className={styles.close} type="button" onClick={onClose}><X size={18} /></button><span className={styles.eyebrow}>Ficonter settings</span><h2>{title}</h2>{children}</div></div>;
}
