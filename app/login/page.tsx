import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Brand } from "@/components/Brand";
import { BrandedLoginEntrance } from "@/components/BrandedLoginEntrance";
import { isFiconterBetaEntryEnvironment } from "@/lib/betaDomainGate";
import { getCurrentUser } from "@/lib/auth/currentUser";

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

  const showEntrance = params.entry === "app" || params.entry === "brand";

  return (
    <>
      {showEntrance ? <BrandedLoginEntrance /> : null}
      <main className="auth-shell">
      <section className="auth-art">
        <Brand />
        <div>
          <div className="eyebrow">
            {betaEntry ? "WELCOME TO FICONTER" : "Welcome back"}
          </div>
          <h1>
            {betaEntry ? "A clearer view of your finances." : "Return to clarity."}
          </h1>
          <p style={{ color: "#cbc6bd", fontSize: 18, lineHeight: 1.7 }}>
            {betaEntry
              ? "Organize, understand and plan your financial life in one private workspace."
              : "Your financial command center is ready."}
          </p>
        </div>
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
          {!showEntrance ? (
            <p className="center">
              <Link href="/">← Back to homepage</Link>
            </p>
          ) : null}
        </div>
      </section>
      </main>
    </>
  );
}
