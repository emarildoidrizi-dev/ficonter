"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  recoveryErrorMessage,
  type AuthEntry,
  withAuthEntry,
} from "@/lib/auth/recovery";
import styles from "./AccountRecoveryForm.module.css";

type RecoveryMode = "password" | "username";
type Message = { type: "success" | "error" | "info"; text: string } | null;
type LoadingAction = "password" | "phone" | "verify" | "resend" | null;

const RESEND_COOLDOWN_SECONDS = 60;

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  return `${trimmed.startsWith("+") ? "+" : ""}${trimmed.replace(/[^0-9]/g, "")}`;
}

function isValidE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

function isRateLimited(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { status?: number; code?: string; message?: string };
  return (
    candidate.status === 429 ||
    candidate.code === "over_request_rate_limit" ||
    candidate.code === "over_email_send_rate_limit" ||
    /rate limit|too many requests|security purposes/i.test(candidate.message ?? "")
  );
}

export function AccountRecoveryForm({
  initialMode,
  entry = null,
  initialError,
}: {
  initialMode: RecoveryMode;
  entry?: AuthEntry | null;
  initialError?: string | null;
}) {
  const supabase = useMemo(() => createClient(false), []);
  const [mode, setMode] = useState<RecoveryMode>(initialMode);
  const [phoneStep, setPhoneStep] = useState<"request" | "verify" | "complete">(
    "request",
  );
  const [phone, setPhone] = useState("");
  const [recoveredUsername, setRecoveredUsername] = useState("");
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [passwordCooldown, setPasswordCooldown] = useState(0);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [message, setMessage] = useState<Message>(() => {
    const text = recoveryErrorMessage(initialError);
    return text ? { type: "error", text } : null;
  });

  const loginHref = withAuthEntry("/login", entry);

  useEffect(() => {
    if (passwordCooldown <= 0 && phoneCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setPasswordCooldown((value) => Math.max(0, value - 1));
      setPhoneCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [passwordCooldown, phoneCooldown]);

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loadingAction || passwordCooldown > 0) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();

    setLoadingAction("password");
    setMessage(null);

    try {
      // Keep the Supabase redirect target query-free. Supabase validates the
      // redirectTo value against its allow list. A query-bearing URL such as
      // /auth/recovery?next=... can fail an exact allow-list match and cause
      // Supabase to fall back to the Site URL (the FICONTER landing page).
      // /auth/recovery already defaults safely to /update-password, so the
      // normal password-reset flow does not need any query parameters here.
      // Use the canonical production recovery origin for every hosted FICONTER
      // environment. This avoids Supabase falling back to the Site URL when a
      // request starts from a Vercel alias, the apex domain, or another host
      // that is not an exact redirect allow-list match. Local development keeps
      // its own origin so the flow remains testable without production DNS.
      const hostname = window.location.hostname.toLowerCase();
      const isLocal =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1";
      const recoveryOrigin = isLocal
        ? window.location.origin
        : "https://www.ficonter.com";
      const recoveryUrl = new URL("/auth/recovery", recoveryOrigin);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: recoveryUrl.toString(),
      });

      if (error) {
        if (isRateLimited(error)) {
          setPasswordCooldown(RESEND_COOLDOWN_SECONDS);
          setMessage({
            type: "info",
            text: "For security, reset emails can only be requested periodically. Wait about a minute and try again.",
          });
          return;
        }

        throw error;
      }

      setPasswordCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage({
        type: "success",
        text: "If a FICONTER account uses that email, a secure password-reset link has been sent. Check your inbox and spam folder.",
      });
    } catch {
      // Do not expose whether an email is registered or return provider details.
      setMessage({
        type: "error",
        text: "The recovery request could not be sent right now. Check your connection and try again.",
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function requestUsernameOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loadingAction || phoneCooldown > 0) return;

    const formData = new FormData(event.currentTarget);
    const submittedPhone = normalizePhone(String(formData.get("phone") ?? ""));

    if (!isValidE164(submittedPhone)) {
      setMessage({
        type: "error",
        text: "Enter the phone number with its country code, for example +4915123456789.",
      });
      return;
    }

    setLoadingAction("phone");
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: submittedPhone,
        options: {
          shouldCreateUser: false,
        },
      });

      setPhone(submittedPhone);
      setPhoneStep("verify");
      setPhoneCooldown(RESEND_COOLDOWN_SECONDS);

      if (error && isRateLimited(error)) {
        setMessage({
          type: "info",
          text: "For security, verification codes can only be requested periodically. Wait about a minute before requesting another code.",
        });
        return;
      }

      // Keep the response deliberately generic so a phone number cannot be used
      // to discover whether an account exists.
      setMessage({
        type: "success",
        text: "If that verified phone number is linked to a FICONTER account, a verification code will arrive shortly.",
      });
    } catch {
      // Preserve the same generic response for anti-enumeration.
      setPhone(submittedPhone);
      setPhoneStep("verify");
      setPhoneCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage({
        type: "info",
        text: "If that verified phone number is linked to a FICONTER account, a verification code will arrive shortly. If no code arrives, use email recovery instead.",
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function resendUsernameOtp() {
    if (!phone || loadingAction || phoneCooldown > 0) return;

    setLoadingAction("resend");
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: false },
      });

      setPhoneCooldown(RESEND_COOLDOWN_SECONDS);

      if (error && isRateLimited(error)) {
        setMessage({
          type: "info",
          text: "Please wait about a minute before requesting another verification code.",
        });
        return;
      }

      setMessage({
        type: "success",
        text: "If the phone is linked to your account, a new verification code has been sent.",
      });
    } catch {
      setPhoneCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage({
        type: "info",
        text: "If the phone is linked to your account, a new verification code will arrive. Otherwise, use email recovery instead.",
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function verifyUsernameOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loadingAction) return;

    const formData = new FormData(event.currentTarget);
    const token = String(formData.get("token") ?? "").trim().replace(/\s+/g, "");

    if (!/^\d{6,8}$/.test(token)) {
      setMessage({
        type: "error",
        text: "Enter the verification code from the SMS message.",
      });
      return;
    }

    setLoadingAction("verify");
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });

      if (error) throw error;

      const loginEmail = String(data.user?.email ?? "").trim();

      if (!loginEmail) {
        throw new Error("missing_login_email");
      }

      setRecoveredUsername(loginEmail);
      setPhoneStep("complete");
      setMessage({
        type: "success",
        text: "Identity verified. Your FICONTER login email is shown below.",
      });

      // OTP verification creates an authenticated recovery session. Remove only
      // this temporary session; never terminate the user's sessions on other devices.
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    } catch {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      setMessage({
        type: "error",
        text: "That verification code is invalid or has expired. Check the code or request a new one.",
      });
    } finally {
      setLoadingAction(null);
    }
  }

  function switchMode(nextMode: RecoveryMode) {
    setMode(nextMode);
    setPhoneStep("request");
    setPhone("");
    setRecoveredUsername("");
    setMessage(null);
  }

  return (
    <div className={styles.shell}>
      <div className={styles.tabs} role="tablist" aria-label="Recovery method">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "password"}
          className={mode === "password" ? styles.activeTab : ""}
          onClick={() => switchMode("password")}
        >
          Forgot password
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "username"}
          className={mode === "username" ? styles.activeTab : ""}
          onClick={() => switchMode("username")}
        >
          Forgot login email
        </button>
      </div>

      {mode === "password" ? (
        <form className={styles.form} onSubmit={requestPasswordReset}>
          <div className={styles.intro}>
            <h2>Reset your password</h2>
            <p>
              Enter the email used for your FICONTER account. We will send a
              secure link that lets you choose a new password.
            </p>
          </div>

          <label>
            Registered email address
            <input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </label>

          {message ? (
            <div
              className={
                message.type === "error"
                  ? styles.error
                  : message.type === "info"
                    ? styles.info
                    : styles.success
              }
            >
              {message.text}
            </div>
          ) : null}

          <button
            className={styles.primary}
            disabled={Boolean(loadingAction) || passwordCooldown > 0}
          >
            {loadingAction === "password"
              ? "Sending…"
              : passwordCooldown > 0
                ? `Send another link in ${passwordCooldown}s`
                : "Send reset link"}
          </button>

          <div className={styles.securityNote}>
            FICONTER never confirms on this screen whether an email address has
            an account. This protects customers from account-discovery attacks.
          </div>
        </form>
      ) : (
        <div className={styles.form}>
          <div className={styles.intro}>
            <h2>Recover your login email</h2>
            <p>
              FICONTER does not use a separate username. Your login ID is your
              registered email address. If you linked and verified a phone
              number, you can use it to recover that email securely.
            </p>
          </div>

          {phoneStep === "request" ? (
            <form className={styles.innerForm} onSubmit={requestUsernameOtp}>
              <label>
                Verified phone number
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+4915123456789"
                  required
                />
              </label>

              {message ? (
                <div
                      className={
                    message.type === "error"
                      ? styles.error
                      : message.type === "info"
                        ? styles.info
                        : styles.success
                  }
                >
                  {message.text}
                </div>
              ) : null}

              <button className={styles.primary} disabled={Boolean(loadingAction)}>
                {loadingAction === "phone" ? "Sending…" : "Send verification code"}
              </button>
            </form>
          ) : null}

          {phoneStep === "verify" ? (
            <form className={styles.innerForm} onSubmit={verifyUsernameOtp}>
              <div className={styles.phoneSummary}>
                Verification requested for <strong>{phone}</strong>
              </div>

              <label>
                Verification code
                <input
                  name="token"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  minLength={6}
                  maxLength={8}
                  required
                />
              </label>

              {message ? (
                <div
                      className={
                    message.type === "error"
                      ? styles.error
                      : message.type === "info"
                        ? styles.info
                        : styles.success
                  }
                >
                  {message.text}
                </div>
              ) : null}

              <button className={styles.primary} disabled={Boolean(loadingAction)}>
                {loadingAction === "verify" ? "Verifying…" : "Verify and show login email"}
              </button>

              <div className={styles.actionRow}>
                <button
                  className={styles.secondary}
                  type="button"
                  disabled={Boolean(loadingAction) || phoneCooldown > 0}
                  onClick={() => void resendUsernameOtp()}
                >
                  {loadingAction === "resend"
                    ? "Sending…"
                    : phoneCooldown > 0
                      ? `Resend in ${phoneCooldown}s`
                      : "Resend code"}
                </button>

                <button
                  className={styles.secondary}
                  type="button"
                  disabled={Boolean(loadingAction)}
                  onClick={() => {
                    setPhoneStep("request");
                    setPhone("");
                    setMessage(null);
                  }}
                >
                  Change phone
                </button>
              </div>
            </form>
          ) : null}

          {phoneStep === "complete" ? (
            <div className={styles.complete}>
              <span>Your FICONTER login email</span>
              <strong>{recoveredUsername}</strong>
              {message ? <div className={styles.success}>{message.text}</div> : null}
              <Link className={styles.primaryLink} href={loginHref}>
                Return to login
              </Link>
            </div>
          ) : null}

          {phoneStep !== "complete" ? (
            <div className={styles.alternative}>
              <strong>No verified phone linked?</strong>
              <p>
                Try an email address you may have used. If it belongs to your
                FICONTER account, the password-recovery email will arrive there.
              </p>
              <button
                type="button"
                className={styles.textButton}
                onClick={() => switchMode("password")}
              >
                Try email recovery
              </button>
            </div>
          ) : null}
        </div>
      )}

      <Link className={styles.backLink} href={loginHref}>
        ← Back to login
      </Link>
    </div>
  );
}
