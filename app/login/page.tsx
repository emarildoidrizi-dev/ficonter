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
          <h1>{betaEntry ? "Invitation required." : "Return to clarity."}</h1>
          <p style={{ color: "#cbc6bd", fontSize: 18, lineHeight: 1.7 }}>
            {betaEntry
              ? "Normal customer accounts cannot enter this Beta platform without a valid invitation code."
              : "Your financial command center is ready."}
          </p>
        </div>
        <p style={{ color: "#8f8a82" }}>Private by design.</p>
      </section>

      <section className="auth-form-wrap">
        <div className="auth-card">
          {!betaEntry ? (
            <>
              <div className="eyebrow">Secure access</div>
              <h2>Log in</h2>
              <p className="muted">Enter your Ficonter account details.</p>
            </>
          ) : null}
          <AuthForm mode="login" betaEntry={betaEntry} />
          <p className="center">
            <Link href="/">← Back to homepage</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
