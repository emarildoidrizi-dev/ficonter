import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, LockKeyhole, Sparkles, WalletCards, Target, ReceiptText } from "lucide-react";
import { Brand } from "@/components/Brand";
import { PublicPreviewGreeting } from "@/components/PublicPreviewGreeting";

const features = [
  [WalletCards, "Unified overview", "See income, expenses, cash flow, bills and net worth from one calm dashboard."],
  [ReceiptText, "Daily money control", "Record transactions, monitor obligations and understand where your money goes."],
  [Target, "Purposeful goals", "Build emergency reserves and long-term goals with clear progress and monthly plans."],
  [BarChart3, "Intelligent insight", "Turn raw numbers into financial health indicators and practical next actions."],
  [LockKeyhole, "Private by design", "Every account has isolated data protected by authentication and database policies."],
  [Sparkles, "Luxury simplicity", "A refined, comfortable interface that removes the stress from financial organization."],
] as const;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;

  if (params.code) {
    redirect(
      `/auth/callback?code=${encodeURIComponent(
        params.code,
      )}&next=${encodeURIComponent("/update-password")}`,
    );
  }

  return (
    <main>
      <div className="container">
        <nav className="nav">
          <Brand />
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#security">Privacy</a>
            <Link href="/login">Log in</Link>
            <Link className="btn btn-gold" href="/register">Create account</Link>
          </div>
        </nav>

        <section className="hero">
          <div>
            <div className="eyebrow">Private wealth, made clear</div>
            <h1>Your private financial command center.</h1>
            <p className="lead">Ficonter brings your financial life into one elegant, secure place—so you can understand today and shape tomorrow with confidence.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/register">Start free <ArrowRight size={18}/></Link>
              <Link className="btn btn-soft" href="/login">Log in</Link>
            </div>
          </div>
          <div className="hero-panel">
            <div className="eyebrow">Private overview</div>
            <PublicPreviewGreeting name="Lido" />
            <p style={{color:"#c9c3ba"}}>Your financial position is stable and improving.</p>
            <div className="metric-grid">
              <div className="metric"><span>Net worth</span><strong>€42,650</strong></div>
              <div className="metric"><span>Cash flow</span><strong style={{color:"#9fb9ad"}}>+€1,240</strong></div>
              <div className="metric"><span>Savings rate</span><strong>28.8%</strong></div>
              <div className="metric"><span>Health score</span><strong>82 / 100</strong></div>
            </div>
          </div>
        </section>
      </div>

      <section id="features" className="section">
        <div className="container">
          <div className="eyebrow">The Ficonter system</div>
          <h2>Everything important. Nothing overwhelming.</h2>
          <p className="section-copy">Ficonter is designed as a financial operating system for individuals and households who value clarity, privacy and a composed experience.</p>
          <div className="cards">
            {features.map(([Icon,title,copy]) => (
              <article className="card" key={title}>
                <div className="icon-box"><Icon size={22}/></div>
                <h3>{title}</h3><p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="section dark-section">
        <div className="container" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:60,alignItems:"center"}}>
          <div>
            <div className="eyebrow">Privacy as a foundation</div>
            <h2>Your financial data belongs to you.</h2>
          </div>
          <p style={{color:"#cbc6bd",lineHeight:1.8,fontSize:18}}>Ficonter uses authenticated accounts and database-level access policies so users can access only their own financial records. We are building without advertising and without selling financial data.</p>
        </div>
      </section>

      <section className="section center">
        <div className="container">
          <div className="eyebrow">Begin with clarity</div>
          <h2>Build a more intentional financial life.</h2>
          <p className="section-copy" style={{margin:"0 auto 28px"}}>Create your private workspace and begin organizing your finances in minutes.</p>
          <Link className="btn btn-gold" href="/register">Create your Ficonter account</Link>
        </div>
      </section>
    </main>
  );
}
