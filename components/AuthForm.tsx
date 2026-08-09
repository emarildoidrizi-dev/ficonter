"use client";

import { PasswordInput } from "./PasswordInput";
import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  createClient,
  saveTrustedDevicePreference,
} from "@/lib/supabase/client";

type AuthFormProps = {
  mode: "login" | "register";
  betaEntry?: boolean;
};

export function AuthForm({ mode, betaEntry = false }: AuthFormProps) {
  const [loading, setLoading] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [entryIntent, setEntryIntent] = useState<"beta" | "free">("beta");
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  async function authorizeCurrentBetaLogin(code: string) {
    const response = await fetch("/api/beta/login-authorize", {
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
        payload.error || "A valid Beta invitation code is required.",
      );
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullName") ?? "").trim();
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const betaCode = String(form.get("betaCode") ?? "").trim();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | null;
    const requestedEntry =
      betaEntry && submitter?.value === "free" ? "free" : "beta";
    const betaIntent = betaEntry && requestedEntry === "beta";
    setEntryIntent(requestedEntry);

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

        // On the private Beta environment a normal signup cannot continue without
        // manually entering a valid invitation code. Public/non-Beta registration
        // still defaults to Free when this field is blank.
        if (betaIntent && !betaCode) {
          throw new Error(
            "Enter the Beta invitation code, or choose Continue with Free plan.",
          );
        }

        let betaSignupToken = "";

        if (betaCode && (!betaEntry || betaIntent)) {
          const betaResponse = await fetch("/api/beta/prepare-signup", {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ code: betaCode }),
          });

          const betaPayload = (await betaResponse.json().catch(() => ({}))) as {
            token?: string;
            error?: string;
          };

          if (!betaResponse.ok || !betaPayload.token) {
            throw new Error(
              betaPayload.error || "The Beta invitation code is invalid.",
            );
          }

          betaSignupToken = betaPayload.token;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              full_name: fullName,
              ...(betaSignupToken
                ? { ficonter_beta_token: betaSignupToken }
                : {}),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          if (betaEntry) {
            if (betaIntent) {
              await authorizeCurrentBetaLogin(betaCode);
            } else {
              const freeResponse = await fetch("/api/beta/continue-free", {
                method: "POST",
                credentials: "same-origin",
                headers: { Accept: "application/json" },
              });
              if (!freeResponse.ok) {
                throw new Error("The Free plan could not be opened.");
              }
            }
          }
          window.location.assign("/dashboard");
          return;
        }

        setMessage({
          type: "success",
          text: "Account created. Check your email to confirm your address.",
        });
        setLoading(false);
      } else {
        // Each explicit login attempt on the Beta environment starts with no
        // trusted Beta-login authorization. The POST below must recreate it.
        if (betaEntry) {
          await fetch("/api/beta/login-authorize", {
            method: "DELETE",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
          }).catch(() => undefined);
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (betaEntry) {
          if (betaIntent) {
            try {
              await authorizeCurrentBetaLogin(betaCode);
            } catch (betaError) {
              // A failed Beta verification must not silently become Beta. The
              // customer can explicitly choose the Free-plan button instead.
              await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
              throw betaError;
            }
          } else {
            const freeResponse = await fetch("/api/beta/continue-free", {
              method: "POST",
              credentials: "same-origin",
              headers: { Accept: "application/json" },
            });
            if (!freeResponse.ok) {
              await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
              throw new Error("The Free plan could not be opened.");
            }
          }
        }

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

  const showBetaCode = mode === "register" || betaEntry;

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

        <PasswordInput
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
          <PasswordInput
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

      {showBetaCode && (
        <div className="field">
          <label htmlFor="beta-code">
            Beta invitation code
            {!betaEntry && mode === "register" ? " (optional)" : ""}
          </label>
          <input
            id="beta-code"
            className="input"
            name="betaCode"
            type="password"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Enter private invitation code"
            required={betaEntry && entryIntent === "beta"}
          />
          <small className="muted">
            {betaEntry
              ? entryIntent === "beta"
                ? "Enter the private invitation code to use Beta access. Owner, Super Admin and Admin accounts are exempt."
                : "You selected the Free plan. No Beta invitation code is needed, and no Beta features will be granted."
              : "Leave this blank for a normal Ficonter Free account. Only a valid invitation code creates Beta access."}
          </small>
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

      {betaEntry ? (
        <>
          <button
            className="btn btn-primary"
            disabled={loading}
            type="submit"
            name="entryMode"
            value="beta"
          >
            {loading && entryIntent === "beta"
              ? "Please wait…"
              : mode === "login"
                ? "Verify invitation & log in"
                : "Verify invitation & create Beta account"}
          </button>
          <button
            className="btn"
            disabled={loading}
            type="submit"
            name="entryMode"
            value="free"
            style={{
              background: "transparent",
              border: "1px solid rgba(120,110,90,.35)",
              color: "var(--ink, #1f2326)",
            }}
          >
            {loading && entryIntent === "free"
              ? "Please wait…"
              : mode === "login"
                ? "Continue with Free plan"
                : "Create Free account"}
          </button>
        </>
      ) : (
        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading
            ? "Please wait…"
            : mode === "login"
              ? "Log in"
              : "Create account"}
        </button>
      )}

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
