import { Brand } from "@/components/Brand";
import { AccountRecoveryForm } from "@/components/AccountRecoveryForm";

export default async function RecoverAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams;
  const initialMode = params.mode === "username" ? "username" : "password";

  return (
    <main className="auth-shell">
      <section className="auth-art">
        <Brand />
        <div>
          <div className="eyebrow">Account recovery</div>
          <h1>Return securely.</h1>
          <p style={{ color: "#cbc6bd", fontSize: 18, lineHeight: 1.7 }}>
            Recover access without exposing private account information.
          </p>
        </div>
        <p style={{ color: "#8f8a82" }}>Protected by Supabase Auth.</p>
      </section>

      <section className="auth-form-wrap">
        <div className="auth-card">
          <AccountRecoveryForm initialMode={initialMode} />
        </div>
      </section>
    </main>
  );
}
