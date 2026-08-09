import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { Brand } from "@/components/Brand";
import { isFiconterBetaEntryEnvironment } from "@/lib/betaDomainGate";

export default async function LoginPage() {
  const betaEntry = await isFiconterBetaEntryEnvironment();

  return (
    <main className="auth-shell">
      <section className="auth-art">
        <Brand />
        <div>
          <div className="eyebrow">
            {betaEntry ? "Private Beta access" : "Welcome back"}
          </div>
          <h1>{betaEntry ? "Choose how to enter." : "Return to clarity."}</h1>
          <p style={{ color: "#cbc6bd", fontSize: 18, lineHeight: 1.7 }}>
            {betaEntry
              ? "Use a verified invitation for Beta access, or continue explicitly with the Free plan."
              : "Your financial command center is ready."}
          </p>
        </div>
        <p style={{ color: "#8f8a82" }}>Private by design.</p>
      </section>

      <section className="auth-form-wrap">
        <div className="auth-card">
          <div className="eyebrow">
            {betaEntry ? "Beta or Free login" : "Secure access"}
          </div>
          <h2>{betaEntry ? "Choose Beta or Free" : "Log in"}</h2>
          <p className="muted">
            {betaEntry
              ? "Beta access requires the invitation code. Free access does not. Owner, Super Admin and Admin accounts are exempt from the customer gate."
              : "Enter your Ficonter account details."}
          </p>
          <AuthForm mode="login" betaEntry={betaEntry} />
          <p className="center">
            <Link href="/">← Back to homepage</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
