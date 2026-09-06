import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  CircleDollarSign,
  Landmark,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

import { Brand } from "@/components/Brand";
import { LanguageSelector } from "@/components/LanguageSelector";

import styles from "./page.module.css";

const productViews = [
  {
    icon: WalletCards,
    title: "Overview",
    copy: "Balance, monthly movement, commitments and financial health in one composed view.",
    stat: "€6,260",
    statLabel: "available after planning",
  },
  {
    icon: Target,
    title: "Planning",
    copy: "Turn budgets, bills and goals into a plan that stays understandable as life changes.",
    stat: "72%",
    statLabel: "monthly plan funded",
  },
  {
    icon: TrendingUp,
    title: "Wealth",
    copy: "Follow net worth, reserves and long-term independence without losing sight of today.",
    stat: "+8.4%",
    statLabel: "twelve-month progress",
  },
  {
    icon: BriefcaseBusiness,
    title: "Business",
    copy: "Keep business revenue, costs, inventory and reporting distinct but close at hand.",
    stat: "31.6%",
    statLabel: "operating margin",
  },
] as const;

const principles = [
  [ShieldCheck, "Private by design", "Authenticated workspaces and database-level access policies keep each account isolated."],
  [Sparkles, "Calm by design", "A clear hierarchy turns complex financial information into focused next steps."],
  [Users, "Personal and business", "Move between household and business finances without mixing the records that matter."],
] as const;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string; entry?: string }>;
}) {
  const params = await searchParams;

  // Recovery safety net: if Supabase or an older email template ever lands a
  // recovery token on the public root URL, never expose the landing page.
  // Route the untouched one-time token envelope to the scanner-safe recovery
  // interstitial instead. The token is still not consumed on this GET.
  if (params.token_hash && params.type === "recovery") {
    const recoveryParams = new URLSearchParams({
      token_hash: params.token_hash,
      type: "recovery",
    });
    if (params.entry) recoveryParams.set("entry", params.entry);
    redirect(`/auth/recovery?${recoveryParams.toString()}`);
  }

  if (params.code) {
    redirect(
      `/auth/callback?code=${encodeURIComponent(
        params.code,
      )}&next=${encodeURIComponent("/update-password")}`,
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Brand />
          <div className={styles.headerActions}>
            <nav className={styles.navigation} aria-label="Public navigation">
              <a href="#platform">Platform</a>
              <a href="#for-you">Personal & Business</a>
              <a href="#privacy">Privacy</a>
              <Link className={styles.loginLink} href="/login?entry=brand">Log in</Link>
              <Link className={styles.headerCta} href="/register">
                Start free
              </Link>
            </nav>
            <div className={styles.headerLanguage}>
              <LanguageSelector variant="public" />
            </div>
          </div>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>Financial Control Center</div>
          <h1><span>Know where you stand.</span><span>Decide what comes next.</span></h1>
          <p className={styles.heroLead}>
            Ficonter brings personal and business finances into one private,
            considered workspace—so every number has context and every plan has
            direction.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/register">
              Start free <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <a className={styles.secondaryButton} href="#platform">
              Explore the platform
            </a>
          </div>
          <div className={styles.heroAssurances} aria-label="Ficonter benefits">
            <span><Check size={16} /> Personal and business workspaces</span>
            <span><Check size={16} /> No advertising</span>
            <span><Check size={16} /> Your data stays yours</span>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.heroGlow} aria-hidden="true" />

          <div className={styles.floatingDashboard}>
            <div className={styles.floatingHeader}>
              <div className={styles.workspaceIdentity}>
                <span className={styles.workspaceDot} aria-hidden="true" />
                <span>Ficonter · Personal workspace</span>
              </div>
              <span className={styles.healthPill}>Healthy</span>
            </div>

            <div className={styles.floatingBody}>
              <div className={styles.floatingTitleRow}>
                <div>
                  <span className={styles.demoLabel}>Demo workspace</span>
                  <strong>This month</strong>
                </div>
                <span className={styles.demoTag}>Fictional demo data</span>
              </div>

              <div className={styles.heroMetricGrid}>
                <div className={styles.heroPrimaryMetric}>
                  <span>Available after planning</span>
                  <strong>€6,260</strong>
                  <p>Across active personal accounts</p>
                </div>
                <div className={styles.heroHealthMetric}>
                  <span>Financial health</span>
                  <div><strong>78</strong><small>/ 100</small></div>
                  <p>Stable and improving</p>
                </div>
              </div>

              <div className={styles.miniProgress}><span /></div>
              <p className={styles.progressCopy}>72% of this month’s plan is already funded.</p>

              <div className={styles.heroMiniStats}>
                <div><span>Income</span><strong>€8,420</strong></div>
                <div><span>Committed</span><strong>€2,160</strong></div>
                <div><span>Reserve</span><strong>€1,850</strong></div>
              </div>
            </div>
          </div>

          <div className={styles.heroSupportCard}>
            <div className={styles.heroSupportImage}>
              <Image
                src="/landing/ficonter-workspace-switch.svg"
                alt="Ficonter personal and business workspaces shown as separate records with a workspace switch between them"
                fill
                sizes="(max-width: 900px) calc(100vw - 68px), 292px"
              />
            </div>
          </div>
        </div>
      </section>

      <div className={styles.proofStrip}>
        <div className={styles.proofItem}>
          <LockKeyhole size={20} />
          <div><strong>Private workspace</strong><span>Account data remains isolated</span></div>
        </div>
        <div className={styles.proofItem}>
          <CircleDollarSign size={20} />
          <div><strong>Clear financial picture</strong><span>Daily control and long-term direction</span></div>
        </div>
        <div className={styles.proofItem}>
          <Landmark size={20} />
          <div><strong>Two worlds, one system</strong><span>Personal and business without confusion</span></div>
        </div>
      </div>

      <section id="platform" className={styles.platformSection}>
        <div className={styles.sectionIntro}>
          <div className={styles.eyebrow}>See the platform</div>
          <h2>A financial picture you can actually use.</h2>
          <p>
            Ficonter is organised around the decisions people make—not around
            spreadsheets. Here is what your control center can bring together.
          </p>
        </div>

        <div className={styles.productWindow} aria-label="Ficonter interface preview">
          <div className={styles.windowBar}>
            <div className={styles.windowDots}><span /><span /><span /></div>
            <span>Ficonter · Personal workspace</span>
            <span className={styles.liveBadge}><i /> Live overview</span>
          </div>
          <div className={styles.windowNav}>
            <span className={styles.activeWindowNav}>Overview</span>
            <span>Money</span>
            <span>Planning</span>
            <span>Wealth</span>
            <span>Intelligence</span>
          </div>
          <div className={styles.windowContent}>
            <div className={styles.windowHeading}>
              <div><small>Good morning</small><h3>Your financial horizon</h3></div>
              <span className={styles.demoTag}>Fictional demo data</span>
            </div>
            <div className={styles.overviewGrid}>
              <article className={styles.availableCard}>
                <span>Available after planning</span>
                <strong>€6,260</strong>
                <p>Across active personal accounts</p>
                <div className={styles.availableSplit}>
                  <div><span>Committed</span><b>€2,160</b></div>
                  <div><span>Reserve</span><b>€1,850</b></div>
                </div>
              </article>
              <article className={styles.healthCard}>
                <span>Financial health</span>
                <div><strong>78</strong><small>/ 100<br />Stable and improving</small></div>
                <div className={styles.healthBar}><i /></div>
                <p>Emergency reserve is moving in the right direction.</p>
              </article>
              <article className={styles.cashFlowCard}>
                <span>Monthly cash flow</span>
                <div className={styles.flowTotals}>
                  <div><small>Income</small><b>€8,420</b></div>
                  <div><small>Spent</small><b>€4,910</b></div>
                </div>
                <div className={styles.flowBars} aria-hidden="true">
                  {[34, 48, 41, 62, 78, 55].map((height, index) => (
                    <i key={index} style={{ height: `${height}%` }} />
                  ))}
                </div>
              </article>
            </div>
          </div>
        </div>

        <div className={styles.viewGrid}>
          {productViews.map(({ icon: Icon, title, copy, stat, statLabel }) => (
            <article className={styles.viewCard} key={title}>
              <div className={styles.viewIcon}><Icon size={21} /></div>
              <div className={styles.viewCardTop}>
                <h3>{title}</h3>
                <ArrowUpRight size={19} />
              </div>
              <p>{copy}</p>
              <div className={styles.viewStat}><strong>{stat}</strong><span>{statLabel}</span></div>
            </article>
          ))}
        </div>
      </section>

      <section id="for-you" className={styles.peopleSection}>
        <div className={styles.sectionIntroLeft}>
          <div className={styles.eyebrow}>Built around real life</div>
          <h2>Clarity at home. Control at work.</h2>
          <p>
            Your financial life has more than one context. Ficonter keeps each
            workspace focused while making the switch between them effortless.
          </p>
        </div>
        <div className={styles.peopleGrid}>
          <article className={styles.storyCard}>
            <div className={styles.storyImage}>
              <Image
                src="/landing/ficonter-personal-finance.webp"
                alt="People using Ficonter to plan their household finances"
                fill
                sizes="(max-width: 800px) 100vw, 50vw"
              />
            </div>
            <div className={styles.storyBody}>
              <span className={styles.storyLabel}><Users size={16} /> Personal</span>
              <h3>Make money conversations easier.</h3>
              <p>See what is available, what is committed and how today’s choices affect tomorrow.</p>
              <ul>
                <li><Check size={16} /> Monthly cash flow and obligations</li>
                <li><Check size={16} /> Goals, reserves and long-term wealth</li>
              </ul>
            </div>
          </article>

          <article className={styles.storyCard}>
            <div className={styles.storyImage}>
              <Image
                src="/landing/ficonter-business-workspace.webp"
                alt="A small business team reviewing their Ficonter business workspace"
                fill
                sizes="(max-width: 800px) 100vw, 50vw"
              />
            </div>
            <div className={styles.storyBody}>
              <span className={styles.storyLabel}><BriefcaseBusiness size={16} /> Business</span>
              <h3>Run the numbers without losing momentum.</h3>
              <p>Keep revenue, operating costs and business records organised in a dedicated workspace.</p>
              <ul>
                <li><Check size={16} /> Revenue, costs and margin visibility</li>
                <li><Check size={16} /> Inventory, suppliers and reporting</li>
              </ul>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.principlesSection}>
        <div className={styles.principleGrid}>
          {principles.map(([Icon, title, copy]) => (
            <article key={title}>
              <div className={styles.principleIcon}><Icon size={22} /></div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="privacy" className={styles.privacySection}>
        <div className={styles.privacyCopy}>
          <div className={styles.eyebrow}>Privacy as a foundation</div>
          <h2>Your finances are personal. The platform treats them that way.</h2>
          <p>
            Ficonter uses authenticated accounts and database-level access
            policies so customers can access only their own records. The
            platform is built without advertising and without selling financial
            data.
          </p>
          <Link className={styles.privacyLink} href="/register">
            Create a private workspace <ArrowRight size={17} />
          </Link>
        </div>
        <div className={styles.privacyVisual}>
          <div className={styles.lockOrb}><LockKeyhole size={40} /></div>
          <div>
            <span>Account protection</span>
            <strong>Private by default</strong>
          </div>
          <div className={styles.securityRows}>
            <span><Check size={16} /> Isolated customer workspaces</span>
            <span><Check size={16} /> Secure authentication</span>
            <span><Check size={16} /> Data access policies</span>
          </div>
        </div>
      </section>

      <section className={styles.finalSection}>
        <div>
          <div className={styles.eyebrow}>Begin with clarity</div>
          <h2>Your financial control center is ready.</h2>
          <p>Create your private workspace and begin organising your finances in minutes.</p>
        </div>
        <div className={styles.finalActions}>
          <Link className={styles.primaryButton} href="/register">
            Create your account <ArrowRight size={18} />
          </Link>
          <Link className={styles.secondaryButton} href="/login?entry=brand">Log in</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <Brand />
        <p>Financial control for the life you are building.</p>
        <div>
          <a href="#platform">Platform</a>
          <a href="#privacy">Privacy</a>
          <Link href="/login?entry=brand">Log in</Link>
        </div>
      </footer>
    </main>
  );
}