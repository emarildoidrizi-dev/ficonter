import { Brand } from "@/components/Brand";
import { UpdatePasswordForm } from "@/components/UpdatePasswordForm";

export default function UpdatePasswordPage() {
  return (
    <main className="auth-shell">
      <section className="auth-art">
        <Brand />
        <div>
          <div className="eyebrow">Password protection</div>
          <h1>Restore access.</h1>
          <p style={{ color: "#cbc6bd", fontSize: 18, lineHeight: 1.7 }}>
            Set a new password through Ficonter’s secure recovery session.
          </p>
        </div>
        <p style={{ color: "#8f8a82" }}>One secure step at a time.</p>
      </section>

      <section className="auth-form-wrap">
        <div className="auth-card">
          <UpdatePasswordForm />
        </div>
      </section>
    </main>
  );
}
