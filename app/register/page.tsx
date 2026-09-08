import Link from "next/link";
import {
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { Brand } from "@/components/Brand";
import { isFiconterBetaEntryEnvironment } from "@/lib/betaDomainGate";
import styles from "../login/login.module.css";

export default async function RegisterPage() {
  const betaEntry = await isFiconterBetaEntryEnvironment();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.brandPanel} aria-label="FICONTER registration introduction">
          <div className={styles.brandTop}>
            <Brand />
          </div>

          <div className={styles.heroArea}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              {betaEntry ? "FICONTER Beta registration" : "Private membership"}
            </div>

            <h1>
              {betaEntry
                ? "Your private Beta workspace starts here."
                : "Build your financial world with clarity."}
            </h1>

            <p>
              {betaEntry
                ? "Use your invitation to create a private Beta workspace and begin organizing your financial life with FICONTER."
                : "Create one secure workspace for personal and business finances, built to keep every plan, commitment and goal in context."}
            </p>

            <div className={styles.assurances} aria-label="FICONTER membership benefits">
              <span><ShieldCheck size={16} aria-hidden="true" /> Private workspace</span>
              <span><LockKeyhole size={16} aria-hidden="true" /> Secure account</span>
              <span><CheckCircle2 size={16} aria-hidden="true" /> No advertising</span>
            </div>

            <div className={styles.preview} aria-label="FICONTER workspace setup preview">
              <div className={styles.previewHeader}>
                <span className={styles.workspaceLabel}>
                  <i className={styles.workspaceDot} aria-hidden="true" />
                  Your FICONTER workspace
                </span>
                <span className={styles.secureLabel}>
                  <ShieldCheck size={13} aria-hidden="true" />
                  Private by design
                </span>
              </div>

              <div className={styles.previewBody}>
                <div className={styles.previewHeadline}>
                  <div>
                    <span>Financial Control Center</span>
                    <strong>Ready when you are</strong>
                  </div>
                  <div className={styles.healthPill}>
                    <small>Access</small>
                    <b>Private</b>
                  </div>
                </div>

                <div className={styles.previewStats}>
                  <div><span>Money</span><strong>Organize</strong></div>
                  <div><span>Planning</span><strong>Decide</strong></div>
                  <div><span>Wealth</span><strong>Progress</strong></div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.brandFoot}>
            <ShieldCheck size={15} aria-hidden="true" />
            Built to keep your financial records focused and under your control.
          </div>
        </section>

        <section className={styles.formSide} aria-label="FICONTER registration form">
          <div className={styles.authCard}>
            {!betaEntry ? (
              <div className={styles.formIntro}>
                <div className={styles.eyebrow}>Create your account</div>
                <h2>Begin your workspace.</h2>
                <p>Set up your FICONTER account and choose the financial preferences you want to start with.</p>
              </div>
            ) : null}

            <AuthForm mode="register" betaEntry={betaEntry} />

            <Link className={styles.backLink} href="/">
              ← Back to homepage
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
