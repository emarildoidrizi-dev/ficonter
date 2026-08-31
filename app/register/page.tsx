import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { Brand } from "@/components/Brand";
import { isFiconterBetaEntryEnvironment } from "@/lib/betaDomainGate";

export default async function RegisterPage() {
  const betaEntry = await isFiconterBetaEntryEnvironment();

  return (
    <main className="auth-shell">
      <section className="auth-art">
        <Brand />
        <div>
          <div className="eyebrow">
            {betaEntry ? "Private Beta registration" : "Begin your private workspace"}
          </div>
          <h1>
            {betaEntry ? "Invitation required." : "Financial confidence starts here."}
          </h1>
          <p style={{ color: "#cbc6bd", fontSize: 18, lineHeight: 1.7 }}>
            {betaEntry
              ? "This Beta address does not allow normal customer registration without a valid invitation code."
              : "Create a secure account and bring your financial life into one elegant system."}
          </p>
        </div>
        <p style={{ color: "#8f8a82" }}>No advertising. No clutter.</p>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          {!betaEntry ? (
            <>
              <div className="eyebrow">Private membership</div>
              <h2>Create account</h2>
              <p className="muted">Use at least eight characters for your password.</p>
            </>
          ) : null}
          <AuthForm mode="register" betaEntry={betaEntry} />
          <p className="center muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
            By creating an account, you agree to the{" "}
            <Link href="/legal/terms"><strong>Terms of Service</strong></Link>{" "}
            and acknowledge the{" "}
            <Link href="/legal/privacy"><strong>Privacy Policy</strong></Link>.
          </p>
          <p className="center">
            <Link href="/">← Back to homepage</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
