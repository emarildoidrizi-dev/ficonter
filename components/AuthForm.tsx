"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  createClient,
  saveTrustedDevicePreference,
} from "@/lib/supabase/client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [loading, setLoading] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullName") ?? "").trim();
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (mode === "register" && password !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      setLoading(false);
      return;
    }

    try {
      if (mode === "login") {
        saveTrustedDevicePreference(keepSignedIn);
      }

      const supabase = createClient(
        mode === "login" ? keepSignedIn : undefined,
      );

      if (mode === "register") {
        const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`;

        if (!fullName) {
          throw new Error("Enter your full name.");
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: { full_name: fullName },
          },
        });

        if (error) throw error;

        if (data.session) {
          window.location.assign("/dashboard");
          return;
        }

        setMessage({
          type: "success",
          text: "Account created. Check your email to confirm your address.",
        });
        setLoading(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        window.location.assign("/dashboard");
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Something went wrong.",
      });
      setLoading(false);
    }
  }

  const recoveryLinkStyle = {
    color: "var(--gold, #b79b6c)",
    fontSize: 12,
    fontWeight: 800,
  } as const;

  const fieldHeaderStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  } as const;

  return (
    <form
      className="form"
      onSubmit={submit}
      method="post"
      action="/login"
      autoComplete="on"
    >
      {mode === "register" && (
        <div className="field">
          <label htmlFor="full-name">Full name</label>
          <input
            id="full-name"
            className="input"
            name="fullName"
            autoComplete="name"
            required
          />
        </div>
      )}

      <div className="field">
        <div style={fieldHeaderStyle}>
          <label htmlFor="ficonter-username">Email address</label>

          {mode === "login" ? (
            <Link
              href="/recover-account?mode=username"
              style={recoveryLinkStyle}
            >
              Forgot username?
            </Link>
          ) : null}
        </div>

        <input
          id="ficonter-username"
          className="input"
          name="username"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          required
        />
      </div>

      <div className="field">
        <div style={fieldHeaderStyle}>
          <label htmlFor="ficonter-password">Password</label>

          {mode === "login" ? (
            <Link
              href="/recover-account?mode=password"
              style={recoveryLinkStyle}
            >
              Forgot password?
            </Link>
          ) : null}
        </div>

        <input
          id="ficonter-password"
          className="input"
          name="password"
          type="password"
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
      </div>

      {mode === "register" && (
        <div className="field">
          <label htmlFor="confirm-password">Confirm password</label>
          <input
            id="confirm-password"
            className="input"
            name="confirmPassword"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </div>
      )}

      {mode === "login" && (
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1.45,
            color: "var(--muted, #756f67)",
          }}
        >
          <input
            type="checkbox"
            checked={keepSignedIn}
            onChange={(event) => setKeepSignedIn(event.target.checked)}
            style={{
              width: 18,
              height: 18,
              marginTop: 2,
              accentColor: "#1f2326",
            }}
          />
          <span>
            <strong style={{ color: "var(--ink, #1f2326)" }}>
              Keep me signed in on this device
            </strong>
            <br />
            Select this only on a personal or trusted computer.
          </span>
        </label>
      )}

      {message && (
        <div
          className={`alert ${
            message.type === "error" ? "alert-error" : "alert-success"
          }`}
        >
          {message.text}
        </div>
      )}

      <button className="btn btn-primary" disabled={loading} type="submit">
        {loading
          ? "Please wait…"
          : mode === "login"
            ? "Log in"
            : "Create account"}
      </button>

      <p className="center muted">
        {mode === "login" ? (
          <>
            New to Ficonter?{" "}
            <Link href="/register">
              <strong>Create an account</strong>
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link href="/login">
              <strong>Log in</strong>
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
