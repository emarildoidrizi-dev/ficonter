"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  CircleUserRound,
  Database,
  Download,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  LayoutTemplate,
  LockKeyhole,
  Palette,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./SettingsWorkspace.module.css";

type Metadata = Record<string, unknown>;
type SectionId =
  | "profile"
  | "security"
  | "financial"
  | "appearance"
  | "privacy"
  | "language";

type Preferences = {
  currency: string;
  numberFormat: string;
  dateFormat: string;
  weekStart: string;
  density: string;
  appearance: string;
  language: string;
};

type Props = {
  userId: string;
  email: string;
  metadata: Metadata;
};

const sections = [
  { id: "profile", label: "Profile", description: "Personal details", icon: UserRound },
  { id: "security", label: "Account & security", description: "Email and password", icon: LockKeyhole },
  { id: "financial", label: "Financial preferences", description: "Currency and formats", icon: SlidersHorizontal },
  { id: "appearance", label: "Appearance", description: "Workspace presentation", icon: Palette },
  { id: "privacy", label: "Data & privacy", description: "Export your records", icon: Database },
  { id: "language", label: "Language", description: "English by default", icon: Globe2 },
] as const;

const defaultPreferences: Preferences = {
  currency: "EUR",
  numberFormat: "de-DE",
  dateFormat: "DD/MM/YYYY",
  weekStart: "monday",
  density: "comfortable",
  appearance: "light",
  language: "en",
};

function readPreferences(metadata: Metadata): Preferences {
  const stored =
    metadata.ficonter_preferences &&
    typeof metadata.ficonter_preferences === "object"
      ? (metadata.ficonter_preferences as Partial<Preferences>)
      : {};

  return { ...defaultPreferences, ...stored };
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SettingsWorkspace({ userId, email, metadata }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [active, setActive] = useState<SectionId>("profile");
  const [fullName, setFullName] = useState(
    String(metadata.full_name ?? metadata.name ?? ""),
  );
  const [displayName, setDisplayName] = useState(
    String(metadata.display_name ?? metadata.full_name ?? ""),
  );
  const [accountEmail, setAccountEmail] = useState(email);
  const [preferences, setPreferences] = useState<Preferences>(() =>
    readPreferences(metadata),
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function showSuccess(text: string) {
    setMessage({ type: "success", text });
    window.setTimeout(() => setMessage(null), 3600);
  }

  function showError(error: unknown, fallback: string) {
    setMessage({
      type: "error",
      text: error instanceof Error ? error.message : fallback,
    });
  }

  async function saveMetadata(nextData: Metadata) {
    const { error } = await supabase.auth.updateUser({
      data: {
        ...metadata,
        ...nextData,
      },
    });

    if (error) throw error;
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await saveMetadata({
        full_name: fullName.trim(),
        display_name: displayName.trim(),
      });
      showSuccess("Profile details saved.");
    } catch (error) {
      showError(error, "Your profile could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const nextEmail = accountEmail.trim().toLowerCase();
      if (!nextEmail) throw new Error("Enter a valid email address.");

      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;

      showSuccess(
        nextEmail === email
          ? "Your email address is unchanged."
          : "Confirmation links were sent. Complete the email change from your inbox.",
      );
    } catch (error) {
      showError(error, "Your email address could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({
        type: "error",
        text: "Use at least eight characters for your new password.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "The new passwords do not match." });
      return;
    }

    setLoading(true);

    try {
      if (currentPassword) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (verifyError) throw new Error("Your current password is incorrect.");
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showSuccess("Your password has been changed successfully.");
    } catch (error) {
      showError(error, "Your password could not be changed.");
    } finally {
      setLoading(false);
    }
  }

  async function savePreferences(next: Preferences, successText: string) {
    setLoading(true);
    setMessage(null);

    try {
      await saveMetadata({ ficonter_preferences: next });
      setPreferences(next);
      showSuccess(successText);
    } catch (error) {
      showError(error, "Your preferences could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function exportAccountData() {
    setLoading(true);
    setMessage(null);

    try {
      const tables = [
        "transactions",
        "bills",
        "debts",
        "debt_payments",
        "monthly_budget_plans",
        "monthly_budget_items",
      ] as const;

      const results = await Promise.all(
        tables.map(async (table) => {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .eq("user_id", userId);

          return [table, error ? [] : data ?? []] as const;
        }),
      );

      const payload = {
        exported_at: new Date().toISOString(),
        account: {
          id: userId,
          email,
          full_name: fullName,
          display_name: displayName,
        },
        preferences,
        data: Object.fromEntries(results),
      };

      downloadFile(
        `ficonter-account-export-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(payload, null, 2),
        "application/json;charset=utf-8",
      );
      showSuccess("Your private account export has been downloaded.");
    } catch (error) {
      showError(error, "Your account export could not be created.");
    } finally {
      setLoading(false);
    }
  }

  const activeSection = sections.find((section) => section.id === active)!;

  return (
    <div className={styles.workspace}>
      <aside className={styles.navigation} aria-label="Settings sections">
        <div className={styles.accountCard}>
          <div className={styles.avatar}>
            <CircleUserRound size={24} />
          </div>
          <div>
            <strong>{displayName || fullName || "Ficonter member"}</strong>
            <span>{email}</span>
          </div>
        </div>

        <div className={styles.sectionList}>
          {sections.map(({ id, label, description, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`${styles.sectionButton}${
                active === id ? ` ${styles.sectionActive}` : ""
              }`}
              onClick={() => {
                setActive(id);
                setMessage(null);
              }}
            >
              <span className={styles.sectionIcon}>
                <Icon size={17} />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      </aside>

      <main className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <span className={styles.eyebrow}>Account preferences</span>
            <h2>{activeSection.label}</h2>
            <p>{activeSection.description}</p>
          </div>
          <div className={styles.secureBadge}>
            <ShieldCheck size={16} />
            Private
          </div>
        </header>

        {message ? (
          <div
            className={`${styles.message} ${
              message.type === "error" ? styles.error : styles.success
            }`}
          >
            {message.type === "success" ? <Check size={17} /> : null}
            {message.text}
          </div>
        ) : null}

        {active === "profile" ? (
          <form className={styles.form} onSubmit={saveProfile}>
            <div className={styles.formGrid}>
              <label>
                <span>Full name</span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  placeholder="Your full name"
                />
              </label>
              <label>
                <span>Display name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Name shown inside Ficonter"
                />
              </label>
            </div>

            <div className={styles.infoStrip}>
              <UserRound size={18} />
              <div>
                <strong>Profile identity</strong>
                <span>
                  Your display name is used for greetings and account-facing
                  personalization only.
                </span>
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.primaryButton} disabled={loading}>
                <Save size={16} />
                {loading ? "Saving…" : "Save profile"}
              </button>
            </div>
          </form>
        ) : null}

        {active === "security" ? (
          <div className={styles.stack}>
            <form className={styles.formCard} onSubmit={updateEmail}>
              <div className={styles.cardHeading}>
                <KeyRound size={19} />
                <div>
                  <h3>Email address</h3>
                  <p>Your email is also your secure login identity.</p>
                </div>
              </div>
              <label>
                <span>Account email</span>
                <input
                  type="email"
                  value={accountEmail}
                  onChange={(event) => setAccountEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <div className={styles.actions}>
                <button className={styles.secondaryButton} disabled={loading}>
                  Update email
                </button>
              </div>
            </form>

            <form className={styles.formCard} onSubmit={updatePassword}>
              <div className={styles.cardHeading}>
                <LockKeyhole size={19} />
                <div>
                  <h3>Change password</h3>
                  <p>Use a strong password that you do not use elsewhere.</p>
                </div>
              </div>

              <label>
                <span>Current password</span>
                <div className={styles.passwordField}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Recommended for verification"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>

              <div className={styles.formGrid}>
                <label>
                  <span>New password</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label>
                  <span>Confirm new password</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </label>
              </div>

              <div className={styles.actions}>
                <button className={styles.primaryButton} disabled={loading}>
                  Change password
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {active === "financial" ? (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void savePreferences(
                preferences,
                "Financial preferences saved.",
              );
            }}
          >
            <div className={styles.formGrid}>
              <label>
                <span>Default currency</span>
                <select
                  value={preferences.currency}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      currency: event.target.value,
                    }))
                  }
                >
                  <option value="EUR">EUR — Euro</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="CHF">CHF — Swiss Franc</option>
                  <option value="ALL">ALL — Albanian Lek</option>
                </select>
              </label>
              <label>
                <span>Number format</span>
                <select
                  value={preferences.numberFormat}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      numberFormat: event.target.value,
                    }))
                  }
                >
                  <option value="de-DE">1.234,56</option>
                  <option value="en-US">1,234.56</option>
                  <option value="fr-FR">1 234,56</option>
                </select>
              </label>
              <label>
                <span>Date format</span>
                <select
                  value={preferences.dateFormat}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      dateFormat: event.target.value,
                    }))
                  }
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </label>
              <label>
                <span>First day of the week</span>
                <select
                  value={preferences.weekStart}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      weekStart: event.target.value,
                    }))
                  }
                >
                  <option value="monday">Monday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </label>
            </div>

            <div className={styles.infoStrip}>
              <LayoutTemplate size={18} />
              <div>
                <strong>Calculation currency remains EUR</strong>
                <span>
                  Ficonter continues to preserve original currencies and use
                  historical EUR equivalents for calculations.
                </span>
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.primaryButton} disabled={loading}>
                <Save size={16} />
                Save preferences
              </button>
            </div>
          </form>
        ) : null}

        {active === "appearance" ? (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void savePreferences(preferences, "Appearance preferences saved.");
            }}
          >
            <fieldset className={styles.optionGroup}>
              <legend>Interface appearance</legend>
              <div className={styles.optionGrid}>
                {[
                  ["light", "Light", "The current refined Ficonter workspace"],
                  ["system", "System", "Follow your device appearance"],
                  ["dark", "Dark", "Prepared for a future interface release"],
                ].map(([value, label, description]) => (
                  <label className={styles.optionCard} key={value}>
                    <input
                      type="radio"
                      name="appearance"
                      value={value}
                      checked={preferences.appearance === value}
                      onChange={() =>
                        setPreferences((current) => ({
                          ...current,
                          appearance: value,
                        }))
                      }
                    />
                    <span className={styles.optionPreview} data-theme={value} />
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.optionGroup}>
              <legend>Layout density</legend>
              <div className={styles.segmented}>
                {[
                  ["comfortable", "Comfortable"],
                  ["compact", "Compact"],
                ].map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="density"
                      value={value}
                      checked={preferences.density === value}
                      onChange={() =>
                        setPreferences((current) => ({
                          ...current,
                          density: value,
                        }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.actions}>
              <button className={styles.primaryButton} disabled={loading}>
                <Save size={16} />
                Save appearance
              </button>
            </div>
          </form>
        ) : null}

        {active === "privacy" ? (
          <div className={styles.stack}>
            <div className={styles.privacyCard}>
              <div className={styles.cardHeading}>
                <Download size={19} />
                <div>
                  <h3>Export account data</h3>
                  <p>
                    Download a private JSON archive of the financial records
                    currently connected to your account.
                  </p>
                </div>
              </div>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => void exportAccountData()}
                disabled={loading}
              >
                <Download size={16} />
                {loading ? "Preparing…" : "Download account export"}
              </button>
            </div>

            <div className={styles.privacyCard}>
              <div className={styles.cardHeading}>
                <ShieldCheck size={19} />
                <div>
                  <h3>Private by design</h3>
                  <p>
                    Your account is authenticated through Supabase and your
                    records remain isolated by account-level access policies.
                  </p>
                </div>
              </div>
              <div className={styles.privacyFacts}>
                <span><Check size={15} /> No advertising profile</span>
                <span><Check size={15} /> No sale of financial records</span>
                <span><Check size={15} /> Account-scoped data access</span>
              </div>
            </div>
          </div>
        ) : null}

        {active === "language" ? (
          <div className={styles.languageCard}>
            <div className={styles.languageIcon}>
              <Globe2 size={26} />
            </div>
            <div>
              <span className={styles.eyebrow}>Standard language</span>
              <h3>English</h3>
              <p>
                Every new Ficonter account uses English by default. Additional
                languages will be introduced after the complete translation
                system is ready.
              </p>
            </div>
            <span className={styles.defaultBadge}>Default</span>
          </div>
        ) : null}
      </main>
    </div>
  );
}
