import { redirect } from "next/navigation";
import { BrowserOnlyHomepageLink } from "@/components/AppAwareAuthNavigation";
import { AuthForm } from "@/components/AuthForm";
import { BrandedLoginEntrance } from "@/components/BrandedLoginEntrance";
import { EmailChangeResultNotice } from "@/components/EmailChangeResultNotice";
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
        <div
          className={styles.shell}
          style={{
            gridTemplateColumns: "minmax(0, 1fr)",
            maxWidth: 720,
          }}
        >
          <section
            className={styles.formSide}
            aria-label="FICONTER login form"
            style={{ minHeight: "calc(100svh - 32px)" }}
          >
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

              <BrowserOnlyHomepageLink className={styles.backLink} />
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
