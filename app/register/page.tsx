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
            {betaEntry ? "Choose Beta or Free." : "Financial confidence starts here."}
          </h1>
          <p style={{ color: "#cbc6bd", fontSize: 18, lineHeight: 1.7 }}>
            {betaEntry
              ? "Use an invitation to create Beta access, or create a normal Free account."
              : "Create a secure account and bring your financial life into one elegant system."}
          </p>
        </div>
        <p style={{ color: "#8f8a82" }}>No advertising. No clutter.</p>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          <div className="eyebrow">
            {betaEntry ? "Beta or Free registration" : "Private membership"}
          </div>
          <h2>{betaEntry ? "Choose Beta or Free" : "Create account"}</h2>
          <p className="muted">
            {betaEntry
              ? "The invitation code is required only for Beta. Every normal signup without Beta verification is Free."
              : "Use at least eight characters for your password."}
          </p>
          <AuthForm mode="register" betaEntry={betaEntry} />
          <p className="center">
            <Link href="/">← Back to homepage</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
