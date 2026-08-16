import Link from "next/link";
import { Brand } from "@/components/Brand";
import { normalizeAuthEntry, withAuthEntry } from "@/lib/auth/recovery";
import styles from "./recovery-link.module.css";

function safeNextPath(value: string | undefined, fallback = "/update-password") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export default async function RecoveryLinkPage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    next?: string;
    entry?: string;
  }>;
}) {
  const params = await searchParams;
  const tokenHash = params.token_hash?.trim() ?? "";
  const isRecovery = params.type === "recovery";
  const next = safeNextPath(params.next);
  const nextUrl = new URL(next, "https://ficonter.invalid");
  const entry = normalizeAuthEntry(params.entry ?? nextUrl.searchParams.get("entry"));
  const recoveryHref = withAuthEntry("/recover-account?mode=password", entry);
  const hasValidEnvelope = Boolean(tokenHash && isRecovery);

  return (
    <main className="auth-shell">
      <section className="auth-art">
        <Brand />
        <div>
          <div className="eyebrow">Secure password recovery</div>
          <h1>One safe step.</h1>
          <p style={{ color: "#cbc6bd", fontSize: 18, lineHeight: 1.7 }}>
            FICONTER waits for your confirmation before using the one-time
            recovery token from your email.
          </p>
        </div>
        <p style={{ color: "#8f8a82" }}>Protected by Supabase Auth.</p>
      </section>

      <section className="auth-form-wrap">
        <div className="auth-card">
          <div className={styles.shell}>
            <div>
              <div className="eyebrow">Password recovery</div>
              <h2>Continue securely</h2>
              <p className={styles.intro}>
                Confirm that you want to use this password-reset link. This
                extra step prevents automatic email scanners from consuming
                the one-time link before you do.
              </p>
            </div>

            {hasValidEnvelope ? (
              <form method="post" action="/auth/recovery/confirm" className={styles.form}>
                <input type="hidden" name="token_hash" value={tokenHash} />
                <input type="hidden" name="type" value="recovery" />
                <input type="hidden" name="next" value={next} />
                {entry ? <input type="hidden" name="entry" value={entry} /> : null}

                <div className={styles.securityNote}>
                  The reset token has not been used yet. Press Continue once to
                  open the new-password screen.
                </div>

                <button type="submit" className={styles.primary}>
                  Continue to reset password
                </button>
              </form>
            ) : (
              <div className={styles.form}>
                <div className={styles.error}>
                  This recovery link is incomplete or invalid. Request a new
                  password-reset email.
                </div>
                <Link className={styles.primaryLink} href={recoveryHref}>
                  Request a new reset link
                </Link>
              </div>
            )}

            <Link className={styles.backLink} href={withAuthEntry("/login", entry)}>
              ← Back to login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
