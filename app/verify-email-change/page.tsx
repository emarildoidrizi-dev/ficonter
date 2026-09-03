"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./verify-email-change.module.css";

type Notice = { type: "success" | "error"; text: string } | null;

export default function VerifyEmailChangePage() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [complete, setComplete] = useState(false);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.replace(/\D/g, "").slice(0, 6);

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setNotice({ type: "error", text: "Enter your new email address." });
      return;
    }
    if (normalizedCode.length !== 6) {
      setNotice({ type: "error", text: "Enter the complete 6-digit verification code." });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedCode,
        type: "email_change",
      });
      if (error) throw error;

      setComplete(true);
      setNotice({
        type: "success",
        text: "Email changed successfully. Your new email address is now your FICONTER login. A security notification is sent to your previous email address.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The verification code could not be confirmed.";
      const expired = /expired|invalid|otp/i.test(message);
      setNotice({
        type: "error",
        text: expired
          ? "That code is invalid or has expired. Request a fresh email-change code from Settings → Profile and try again."
          : message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="email-change-title">
        <div className={styles.icon}><ShieldCheck size={28} /></div>
        <span className={styles.eyebrow}>EMAIL CHANGE VERIFICATION</span>
        <h1 id="email-change-title">Confirm your new email</h1>
        <p className={styles.lead}>
          Enter the 6-digit code sent to your new email address. Your previous email address does not need to approve the change; it will receive a security notification after the change is completed.
        </p>

        {notice ? (
          <div className={`${styles.notice} ${notice.type === "error" ? styles.error : styles.success}`} role="status">
            {notice.type === "success" ? <CheckCircle2 size={18} /> : <KeyRound size={18} />}
            <span>{notice.text}</span>
          </div>
        ) : null}

        {!complete ? (
          <form className={styles.form} onSubmit={verify}>
            <label>
              <span>New email address</span>
              <div className={styles.inputWrap}><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="new@example.com" required /></div>
            </label>
            <label>
              <span>6-digit verification code</span>
              <div className={styles.inputWrap}><KeyRound size={17} /><input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required /></div>
            </label>
            <button className={styles.primary} disabled={loading}>{loading ? "Verifying…" : "Confirm new email"}</button>
          </form>
        ) : null}

        <div className={styles.help}>
          <strong>Didn’t receive a code?</strong>
          <p>Return to Settings → Profile → Login email and request a fresh email-change code. Supabase may apply a short resend cooldown for security.</p>
        </div>

        <div className={styles.actions}>
          <Link href="/dashboard/settings?section=profile">Back to Profile settings</Link>
          <Link href="/login">Go to login</Link>
        </div>
      </section>
    </main>
  );
}
