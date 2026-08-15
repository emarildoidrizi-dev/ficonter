"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "./UpdatePasswordForm.module.css";

export function UpdatePasswordForm() {
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function inspectSession() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (data.session) {
        setReady(true);
      } else {
        setMessage({
          type: "error",
          text:
            "This password-reset link is invalid or has expired. Request a new link.",
        });
      }
    }

    void inspectSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY" || session) {
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
    const confirmPassword = String(
      formData.get("confirmPassword") ?? "",
    );

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

      if (updateError) {
        throw updateError;
      }

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      setMessage({
        type: "success",
        text: "Your Ficonter password has been changed successfully.",
      });
      setComplete(true);
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "The password could not be changed.",
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
              className={
                message.type === "error" ? styles.error : styles.success
              }
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
          <Link href="/login">Return to login</Link>
        </div>
      )}

      {!ready && !complete ? (
        <Link className={styles.requestLink} href="/recover-account?mode=password">
          Request another reset link
        </Link>
      ) : null}
    </div>
  );
}
