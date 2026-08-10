"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  Check,
  Columns3,
  Command,
  Eye,
  Grid2X2,
  Layers3,
  LayoutDashboard,
  Maximize2,
  Monitor,
  PanelLeftClose,
  Rows3,
  Smartphone,
  Sparkles,
  Tablet,
  WandSparkles,
  X,
} from "lucide-react";
import styles from "./UiLab.module.css";

type LayoutId =
  | "executive"
  | "rail"
  | "bento"
  | "floating"
  | "context"
  | "adaptive"
  | "data"
  | "tabs"
  | "split";

type Device = "desktop" | "tablet" | "mobile";
type Workspace = "personal" | "business";

type LayoutDefinition = {
  id: LayoutId;
  name: string;
  shortName: string;
  description: string;
  bestFor: string;
  icon: typeof LayoutDashboard;
};

const LAYOUTS: LayoutDefinition[] = [
  {
    id: "executive",
    name: "Executive Command Center",
    shortName: "Executive",
    description: "Premium structured finance workspace with strong hierarchy and familiar navigation.",
    bestFor: "Default / professional users",
    icon: LayoutDashboard,
  },
  {
    id: "rail",
    name: "Ultra-Minimal Navigation Rail",
    shortName: "Compact Rail",
    description: "Slim icon rail that maximizes usable financial workspace without losing navigation.",
    bestFor: "Large screens / focused work",
    icon: PanelLeftClose,
  },
  {
    id: "bento",
    name: "Bento Dashboard",
    shortName: "Bento",
    description: "Modular information blocks sized by importance for a highly visual Overview.",
    bestFor: "Overview / intelligence",
    icon: Grid2X2,
  },
  {
    id: "floating",
    name: "Floating Workspace",
    shortName: "Floating",
    description: "Premium floating surfaces and glass panels layered over FICONTER themes and scenes.",
    bestFor: "Premium visual identity",
    icon: Layers3,
  },
  {
    id: "context",
    name: "Top Navigation + Context Sidebar",
    shortName: "Context Nav",
    description: "Top-level financial categories with a contextual secondary navigation for each area.",
    bestFor: "Growing module library",
    icon: Rows3,
  },
  {
    id: "adaptive",
    name: "Adaptive Financial OS",
    shortName: "Adaptive OS",
    description: "Workspace controls adapt to the current task, module and financial context.",
    bestFor: "Long-term FICONTER UX",
    icon: Command,
  },
  {
    id: "data",
    name: "Horizontal / Data-Focused",
    shortName: "Data Focus",
    description: "Dense horizontal workspace optimized for tables, analytics, reconciliation and power users.",
    bestFor: "Power users / large monitors",
    icon: BarChart3,
  },
  {
    id: "tabs",
    name: "Card Stack / Tab View",
    shortName: "Tab Stack",
    description: "Major financial areas behave like persistent workspace tabs with layered content cards.",
    bestFor: "Multitasking / quick switching",
    icon: Columns3,
  },
  {
    id: "split",
    name: "Split-Screen Analytics",
    shortName: "Split Analytics",
    description: "Operational controls on one side and large analytical views on the other.",
    bestFor: "Cash Flow / Net Worth / Business",
    icon: Maximize2,
  },
];

const DEVICE_LABELS: Record<Device, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

export function UiLab() {
  const [workspace, setWorkspace] = useState<Workspace>("personal");
  const [device, setDevice] = useState<Device>("desktop");
  const [preview, setPreview] = useState<LayoutId | null>(null);
  const [compare, setCompare] = useState<LayoutId[]>([]);

  const previewLayout = useMemo(
    () => LAYOUTS.find((layout) => layout.id === preview) ?? null,
    [preview],
  );

  function toggleCompare(id: LayoutId) {
    setCompare((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) return [current[1], id];
      return [...current, id];
    });
  }

  return (
    <section className={styles.lab}>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}><WandSparkles size={14} /> OWNER UI LAB</div>
          <h1>Design the next FICONTER experience.</h1>
          <p>
            Private design workspace. Nothing here changes the public customer interface.
            Review, compare and evolve layouts before anything reaches Beta or Production.
          </p>
        </div>
        <div className={styles.statusCard}>
          <span>Public UI</span><strong>Stable</strong>
          <span>UI Lab</span><strong>Internal only</strong>
          <span>Release authority</span><strong>Owner</strong>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.segment} aria-label="Preview workspace">
          <button className={workspace === "personal" ? styles.active : ""} onClick={() => setWorkspace("personal")}>
            <Sparkles size={14} /> Personal
          </button>
          <button className={workspace === "business" ? styles.active : ""} onClick={() => setWorkspace("business")}>
            <Building2 size={14} /> Business
          </button>
        </div>

        <div className={styles.segment} aria-label="Preview device">
          <button className={device === "desktop" ? styles.active : ""} onClick={() => setDevice("desktop")} title="Desktop"><Monitor size={15} /></button>
          <button className={device === "tablet" ? styles.active : ""} onClick={() => setDevice("tablet")} title="Tablet"><Tablet size={15} /></button>
          <button className={device === "mobile" ? styles.active : ""} onClick={() => setDevice("mobile")} title="Mobile"><Smartphone size={15} /></button>
        </div>

        <div className={styles.releaseNote}>
          <span>Candidate channel</span>
          <strong>Internal · UI 1.0 Lab</strong>
        </div>
      </div>

      <div className={styles.grid}>
        {LAYOUTS.map((layout, index) => {
          const selectedForCompare = compare.includes(layout.id);
          const Icon = layout.icon;
          return (
            <article className={styles.layoutCard} key={layout.id}>
              <div className={styles.cardTop}>
                <div className={styles.number}>{String(index + 1).padStart(2, "0")}</div>
                <span className={styles.internal}>INTERNAL</span>
              </div>

              <div className={styles.previewShell}>
                <DashboardPreview layout={layout.id} workspace={workspace} device={device} miniature />
              </div>

              <div className={styles.cardBody}>
                <div className={styles.titleRow}>
                  <Icon size={18} />
                  <div><h2>{layout.name}</h2><span>{layout.bestFor}</span></div>
                </div>
                <p>{layout.description}</p>
                <div className={styles.actions}>
                  <button className={styles.primary} onClick={() => setPreview(layout.id)}><Eye size={14} /> Preview</button>
                  <button className={selectedForCompare ? styles.compareActive : styles.secondary} onClick={() => toggleCompare(layout.id)}>
                    {selectedForCompare ? <Check size={14} /> : <Columns3 size={14} />}
                    {selectedForCompare ? "Selected" : "Compare"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {compare.length === 2 ? (
        <section className={styles.compareBoard}>
          <div className={styles.compareHeading}>
            <div><span>OWNER COMPARISON</span><h2>Compare two directions</h2></div>
            <button onClick={() => setCompare([])}><X size={15} /> Clear</button>
          </div>
          <div className={styles.compareGrid}>
            {compare.map((id) => {
              const layout = LAYOUTS.find((item) => item.id === id)!;
              return (
                <div className={styles.compareItem} key={id}>
                  <strong>{layout.name}</strong>
                  <DashboardPreview layout={id} workspace={workspace} device={device} />
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className={styles.compareHint}>Select <strong>two layouts</strong> with Compare to open the side-by-side Owner comparison board.</div>
      )}

      {previewLayout ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setPreview(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`${previewLayout.name} preview`} onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div><span>OWNER PREVIEW · {DEVICE_LABELS[device].toUpperCase()}</span><h2>{previewLayout.name}</h2><p>{previewLayout.description}</p></div>
              <button onClick={() => setPreview(null)} aria-label="Close preview"><X size={18} /></button>
            </div>
            <div className={styles.modalControls}>
              <div className={styles.segment}>
                <button className={workspace === "personal" ? styles.active : ""} onClick={() => setWorkspace("personal")}>Personal</button>
                <button className={workspace === "business" ? styles.active : ""} onClick={() => setWorkspace("business")}>Business</button>
              </div>
              <div className={styles.segment}>
                <button className={device === "desktop" ? styles.active : ""} onClick={() => setDevice("desktop")}><Monitor size={14} /></button>
                <button className={device === "tablet" ? styles.active : ""} onClick={() => setDevice("tablet")}><Tablet size={14} /></button>
                <button className={device === "mobile" ? styles.active : ""} onClick={() => setDevice("mobile")}><Smartphone size={14} /></button>
              </div>
            </div>
            <div className={styles.fullPreview}><DashboardPreview layout={previewLayout.id} workspace={workspace} device={device} /></div>
            <div className={styles.modalFooter}>
              <span>This is an internal presentation prototype. Financial data and production UI are untouched.</span>
              <button onClick={() => toggleCompare(previewLayout.id)}><Columns3 size={14} /> Add to comparison</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DashboardPreview({
  layout,
  workspace,
  device,
  miniature = false,
}: {
  layout: LayoutId;
  workspace: Workspace;
  device: Device;
  miniature?: boolean;
}) {
  const business = workspace === "business";
  const labels = business
    ? { title: "Business Overview", a: "Revenue", b: "Operating costs", c: "Available cash", nav: ["Overview", "Sales", "Expenses", "Inventory", "Reports"] }
    : { title: "Personal Overview", a: "Income", b: "Expenses", c: "Cash position", nav: ["Overview", "Transactions", "Bills", "Planner", "Net Worth"] };

  return (
    <div className={`${styles.device} ${styles[device]} ${miniature ? styles.miniature : ""}`}>
      <div className={`${styles.dashboard} ${styles[`layout_${layout}`]}`}>
        <aside className={styles.mockSidebar}>
          <div className={styles.mockBrand}>FICONTER</div>
          <div className={styles.mockNav}>
            {labels.nav.map((item, idx) => <span className={idx === 0 ? styles.mockActive : ""} key={item}><i />{device === "mobile" ? "" : item}</span>)}
          </div>
          <small>{business ? "BUSINESS" : "PERSONAL"}</small>
        </aside>

        <div className={styles.mockWorkspace}>
          <div className={styles.mockTopNav}><span>Overview</span><span>Money</span><span>Planning</span><span>Wealth</span><b>Live</b></div>
          <div className={styles.mockHeader}>
            <div><small>{business ? "BUSINESS WORKSPACE" : "FINANCIAL CONTROL CENTER"}</small><h3>{labels.title}</h3><p>{business ? "Operational performance and cash control." : "Your financial position at a glance."}</p></div>
            <button>+ Add</button>
          </div>

          <div className={styles.mockKpis}>
            <MockCard label={labels.a} value={business ? "€12,840" : "€3,454"} />
            <MockCard label={labels.b} value={business ? "€8,270" : "€3,010"} />
            <MockCard label={labels.c} value={business ? "€4,570" : "+€444"} featured />
          </div>

          <div className={styles.mockMain}>
            <div className={styles.mockChartCard}>
              <div className={styles.mockCardHead}><strong>{business ? "Cash performance" : "Financial trend"}</strong><span>30 days</span></div>
              <div className={styles.mockChart}><i/><i/><i/><i/><i/><i/><i/><i/></div>
              <div className={styles.mockLegend}><span>Income</span><span>Outflow</span></div>
            </div>
            <div className={styles.mockInsight}>
              <small>{business ? "BUSINESS GPS" : "FINANCIAL GPS"}</small>
              <strong>{business ? "Operating margin is improving." : "You are cash-flow positive."}</strong>
              <p>{business ? "Revenue is covering operating costs with room to protect liquidity." : "Your current month is positive. Protect the remaining balance."}</p>
              <div className={styles.mockProgress}><i /></div>
              <span>{business ? "Margin 35%" : "Emergency fund 50%"}</span>
            </div>
          </div>

          <div className={styles.mockBottom}>
            <MockCard label="Upcoming" value={business ? "7 invoices" : "6 bills"} />
            <MockCard label={business ? "Receivables" : "Goals"} value={business ? "€2,120" : "2 active"} />
            <MockCard label={business ? "Runway" : "Net worth"} value={business ? "4.8 mo" : "€16,170"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MockCard({ label, value, featured = false }: { label: string; value: string; featured?: boolean }) {
  return <div className={`${styles.mockCard} ${featured ? styles.mockFeatured : ""}`}><span>{label}</span><strong>{value}</strong><small>Updated now</small></div>;
}
