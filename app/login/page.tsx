import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { Brand } from "@/components/Brand";
import { BrandedLoginEntrance } from "@/components/BrandedLoginEntrance";
import { EmailChangeResultNotice } from "@/components/EmailChangeResultNotice";
import { LandingHeroShowcase } from "@/components/LandingHeroShowcase";
import { isFiconterBetaEntryEnvironment } from "@/lib/betaDomainGate";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { normalizeAuthEntry } from "@/lib/auth/recovery";
import styles from "./login.module.css";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ entry?: string }>;
}) {
  const [{ user }, betaEntry, params] = await Promise.all([
    getCurrentUser(),
    isFiconterBetaEntryEnvironment(),
    searchParams,
  ]);

  if (user) redirect("/dashboard");

  const entry = normalizeAuthEntry(params.entry);
  const showEntrance = Boolean(entry);

  return (
    <>
      {showEntrance ? <BrandedLoginEntrance /> : null}

      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.brandPanel} aria-label="FICONTER secure access introduction">
            <div className={styles.brandTop}>
              <Brand />
            </div>

            <div className={styles.heroArea}>
              <div className={styles.eyebrow}>
                <span className={styles.eyebrowDot} aria-hidden="true" />
                {betaEntry ? "FICONTER Beta access" : "Secure access"}
              </div>

              <h1>
                {betaEntry
                  ? "A clearer way into your financial world."
                  : "Return to your financial world."}
              </h1>

              <p>
                {betaEntry
                  ? "Organize, understand and plan your financial life in one private workspace."
                  : "Continue exactly where you left off, with your personal and business finances kept clear, private and connected."}
              </p>

              <div className={styles.assurances} aria-label="FICONTER account protections">
                <span><ShieldCheck size={16} aria-hidden="true" /> Private workspace</span>
                <span><LockKeyhole size={16} aria-hidden="true" /> Secure authentication</span>
                <span><CheckCircle2 size={16} aria-hidden="true" /> Personal & business</span>
              </div>

              <div className={styles.preview} aria-label="FICONTER rotating workspace preview">
                <LandingHeroShowcase />
              </div>
            </div>

            <div className={styles.brandFoot}>
              <ShieldCheck size={15} aria-hidden="true" />
              Your financial workspace remains private by design.
            </div>
          </section>

          <section className={styles.formSide} aria-label="FICONTER login form">
            <div className={styles.authCard}>
              {!betaEntry ? (
                <div className={styles.formIntro}>
                  <div className={styles.eyebrow}>FICONTER account</div>
                  <h2>Welcome back.</h2>
                  <p>Sign in to continue to your Financial Control Center.</p>
                </div>
              ) : null}

              <EmailChangeResultNotice />
              <AuthForm mode="login" betaEntry={betaEntry} entry={entry} />

              {!showEntrance ? (
                <Link className={styles.backLink} href="/">
                  ← Back to homepage
                </Link>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
