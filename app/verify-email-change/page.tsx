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
  const [approvalCount, setApprovalCount] = useState(0);
  const [complete, setComplete] = useState(false);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.replace(/\D/g, "").slice(0, 6);

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setNotice({ type: "error", text: "Enter the email address that received this code." });
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

      const { data } = await supabase.auth.getUser();
      const pending = (data.user as { new_email?: string | null } | null)?.new_email?.trim() || "";

      if (!pending) {
        setComplete(true);
        setApprovalCount(2);
        setNotice({
          type: "success",
          text: "Email changed successfully. Your new email address is now your FICONTER login.",
        });
        return;
      }

      setApprovalCount((count) => Math.max(1, count + 1));
      setEmail("");
      setCode("");
      setNotice({
        type: "success",
        text: "This email was approved. Now enter the 6-digit code sent to the other email address to finish the change.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The verification code could not be confirmed.";
      const expired = /expired|invalid|otp/i.test(message);
      setNotice({
        type: "error",
        text: expired
          ? "That code is invalid or has expired. Request fresh email-change codes from Settings → Profile and try again."
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
        <span className={styles.eyebrow}>SECURE EMAIL CHANGE</span>
        <h1 id="email-change-title">Verify your email change</h1>
        <p className={styles.lead}>
          FICONTER uses one-time verification codes instead of confirmation links. With Secure Email Change, both your current email and your new email must approve the change.
        </p>

        <div className={styles.progress} aria-label="Email verification progress">
          <span className={approvalCount >= 1 ? styles.done : ""}>1</span>
          <i />
          <span className={complete || approvalCount >= 2 ? styles.done : ""}>2</span>
        </div>

        {notice ? (
          <div className={`${styles.notice} ${notice.type === "error" ? styles.error : styles.success}`} role="status">
            {notice.type === "success" ? <CheckCircle2 size={18} /> : <KeyRound size={18} />}
            <span>{notice.text}</span>
          </div>
        ) : null}

        {!complete ? (
          <form className={styles.form} onSubmit={verify}>
            <label>
              <span>Email address that received this code</span>
              <div className={styles.inputWrap}><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" required /></div>
            </label>
            <label>
              <span>6-digit verification code</span>
              <div className={styles.inputWrap}><KeyRound size={17} /><input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required /></div>
            </label>
            <button className={styles.primary} disabled={loading}>{loading ? "Verifying…" : "Verify code"}</button>
          </form>
        ) : null}

        <div className={styles.help}>
          <strong>Didn’t receive a code?</strong>
          <p>Return to Settings → Profile → Login email and request fresh email-change codes. Supabase may apply a short resend cooldown for security.</p>
        </div>

        <div className={styles.actions}>
          <Link href="/dashboard/settings?section=profile">Back to Profile settings</Link>
          <Link href="/login">Go to login</Link>
        </div>
      </section>
    </main>
  );
}
