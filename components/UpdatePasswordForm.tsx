"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { type AuthEntry, withAuthEntry } from "@/lib/auth/recovery";
import styles from "./UpdatePasswordForm.module.css";

export function UpdatePasswordForm({ entry = null }: { entry?: AuthEntry | null }) {
  const supabase = useMemo(() => createClient(false), []);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loginHref = withAuthEntry("/login", entry);
  const recoveryHref = withAuthEntry("/recover-account?mode=password", entry);

  useEffect(() => {
    let mounted = true;

    async function inspectSession() {
      const { data, error } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!error && data.user) {
        setReady(true);
        setMessage(null);
      } else {
        setMessage({
          type: "error",
          text: "This password-reset link is invalid or has expired. Request a new link.",
        });
      }
    }

    void inspectSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY" && session) {
        setReady(true);
        setMessage(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ready || loading) return;

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password.length < 8) {
      setMessage({
        type: "error",
        text: "Use at least eight characters for your new password.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({
        type: "error",
        text: "The passwords do not match.",
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      // Password recovery is a security event: explicitly terminate the old
      // sessions after the password changes. If global revocation fails, at
      // minimum remove this recovery session locally before returning to login.
      const { error: globalSignOutError } = await supabase.auth.signOut({
        scope: "global",
      });

      if (globalSignOutError) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      }

      setMessage({
        type: "success",
        text: "Your FICONTER password has been changed. Sign in again with your new password.",
      });
      setComplete(true);
      setReady(false);
    } catch {
      setMessage({
        type: "error",
        text: "The password could not be changed. Request a new recovery link if this one has expired.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.shell}>
      <div>
        <div className="eyebrow">Secure recovery</div>
        <h2>Choose a new password</h2>
        <p className={styles.intro}>
          Create a strong password that you do not use for another service.
        </p>
      </div>

      {!complete ? (
        <form className={styles.form} onSubmit={updatePassword}>
          <label>
            New password
            <input
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              disabled={!ready}
              required
            />
          </label>

          <label>
            Confirm new password
            <input
              name="confirmPassword"
              type="password"
              minLength={8}
              autoComplete="new-password"
              disabled={!ready}
              required
            />
          </label>

          {message ? (
            <div
              className={message.type === "error" ? styles.error : styles.success}
            >
              {message.text}
            </div>
          ) : null}

          <button disabled={!ready || loading}>
            {loading
              ? "Changing password…"
              : ready
                ? "Change password"
                : "Validating reset link…"}
          </button>
        </form>
      ) : (
        <div className={styles.complete}>
          {message ? <div className={styles.success}>{message.text}</div> : null}
          <Link href={loginHref}>Return to login</Link>
        </div>
      )}

      {!ready && !complete ? (
        <Link className={styles.requestLink} href={recoveryHref}>
          Request another reset link
        </Link>
      ) : null}
    </div>
  );
}
