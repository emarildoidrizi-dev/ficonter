"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "./AccountRecoveryForm.module.css";

type RecoveryMode = "password" | "username";
type Message = { type: "success" | "error"; text: string } | null;

export function AccountRecoveryForm({
  initialMode,
}: {
  initialMode: RecoveryMode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<RecoveryMode>(initialMode);
  const [phoneStep, setPhoneStep] = useState<"request" | "verify" | "complete">(
    "request",
  );
  const [phone, setPhone] = useState("");
  const [recoveredUsername, setRecoveredUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();

    setLoading(true);
    setMessage(null);

    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/update-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) throw error;

      // Keep this generic so the screen does not reveal whether an account exists.
      setMessage({
        type: "success",
        text:
          "If an account uses that email, Ficonter has sent a secure password-reset link.",
      });
      formElement.reset();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "The reset request could not be sent.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function requestUsernameOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const formData = new FormData(event.currentTarget);
    const submittedPhone = String(formData.get("phone") ?? "").trim();

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: submittedPhone,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) throw error;

      setPhone(submittedPhone);
      setPhoneStep("verify");
      setMessage({
        type: "success",
        text: "A verification code was sent to the linked phone number.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "The verification code could not be sent.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function verifyUsernameOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const formData = new FormData(event.currentTarget);
    const token = String(formData.get("token") ?? "").trim();

    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });

      if (error) throw error;

      const username =
        String(data.user?.user_metadata?.username ?? "").trim() ||
        String(data.user?.email ?? "").trim();

      if (!username) {
        throw new Error(
          "This account does not have a recoverable email username.",
        );
      }

      setRecoveredUsername(username);
      setPhoneStep("complete");
      setMessage({
        type: "success",
        text: "Identity verified. Your Ficonter username is shown below.",
      });

      // Account recovery must not leave the user silently signed in.
      await supabase.auth.signOut();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "The verification code could not be confirmed.",
      });
    } finally {
      setLoading(false);
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
          className={mode === "password" ? styles.activeTab : ""}
          onClick={() => switchMode("password")}
        >
          Forgot password
        </button>
        <button
          type="button"
          className={mode === "username" ? styles.activeTab : ""}
          onClick={() => switchMode("username")}
        >
          Forgot username
        </button>
      </div>

      {mode === "password" ? (
        <form className={styles.form} onSubmit={requestPasswordReset}>
          <div className={styles.intro}>
            <h2>Reset your password</h2>
            <p>
              Enter the email used for your Ficonter account. We will send a
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
              required
            />
          </label>

          {message ? (
            <div
              className={
                message.type === "error" ? styles.error : styles.success
              }
            >
              {message.text}
            </div>
          ) : null}

          <button className={styles.primary} disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      ) : (
        <div className={styles.form}>
          <div className={styles.intro}>
            <h2>Recover your username</h2>
            <p>
              Your Ficonter username is your registered email address. Verify a
              phone number previously linked to the same account to reveal it.
            </p>
          </div>

          {phoneStep === "request" ? (
            <form className={styles.innerForm} onSubmit={requestUsernameOtp}>
              <label>
                Linked phone number
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+49 151 23456789"
                  required
                />
              </label>

              {message ? (
                <div
                  className={
                    message.type === "error" ? styles.error : styles.success
                  }
                >
                  {message.text}
                </div>
              ) : null}

              <button className={styles.primary} disabled={loading}>
                {loading ? "Sending…" : "Send verification code"}
              </button>
            </form>
          ) : null}

          {phoneStep === "verify" ? (
            <form className={styles.innerForm} onSubmit={verifyUsernameOtp}>
              <div className={styles.phoneSummary}>
                Code sent to <strong>{phone}</strong>
              </div>

              <label>
                Verification code
                <input
                  name="token"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  minLength={6}
                  maxLength={8}
                  required
                />
              </label>

              {message ? (
                <div
                  className={
                    message.type === "error" ? styles.error : styles.success
                  }
                >
                  {message.text}
                </div>
              ) : null}

              <button className={styles.primary} disabled={loading}>
                {loading ? "Verifying…" : "Verify and recover username"}
              </button>

              <button
                className={styles.secondary}
                type="button"
                onClick={() => {
                  setPhoneStep("request");
                  setMessage(null);
                }}
              >
                Use another phone number
              </button>
            </form>
          ) : null}

          {phoneStep === "complete" ? (
            <div className={styles.complete}>
              <span>Your Ficonter username</span>
              <strong>{recoveredUsername}</strong>
              {message ? <div className={styles.success}>{message.text}</div> : null}
              <Link className={styles.primaryLink} href="/login">
                Return to login
              </Link>
            </div>
          ) : null}

          <div className={styles.securityNote}>
            Phone recovery works only when SMS authentication is enabled and
            that phone number has already been verified and linked to the user’s
            Supabase Auth account.
          </div>
        </div>
      )}

      <Link className={styles.backLink} href="/login">
        ← Back to login
      </Link>
    </div>
  );
}
