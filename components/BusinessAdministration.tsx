"use client";

import Link from "next/link";
import {
  Activity,
  Archive,
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FileClock,
  ImageIcon,
  ImagePlus,
  Landmark,
  PackageOpen,
  ReceiptText,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Trash2,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CURRENCY_CODES,
  currencyName,
  currencySymbol,
} from "@/lib/financialOptions";
import type { Business } from "@/lib/business/types";
import styles from "./BusinessAdministration.module.css";

const BUSINESS_ASSET_BUCKET = "business-assets";
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const LOGO_MAX_BYTES = 3 * 1024 * 1024;
const COVER_MAX_BYTES = 5 * 1024 * 1024;

const BUSINESS_TYPES = [
  "Sole trader",
  "Freelancer",
  "Partnership",
  "Limited company",
  "Retail business",
  "Restaurant / hospitality",
  "Creative studio",
  "Online business",
  "Other",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const TABS = [
  ["profile", Building2, "Business Profile"],
  ["financial", Settings2, "Financial Setup"],
  ["audit", FileClock, "Audit Log"],
  ["data", Database, "Data & Status"],
] as const;

type TabId = (typeof TABS)[number][0];

type AdministrationSettings = {
  business_id: string;
  default_timezone: string;
  date_format: string;
  number_format: string;
  default_payment_method: string;
  default_payment_terms_days: number;
  default_sales_tax_rate: number | string;
  invoice_prefix: string;
  next_invoice_number: number;
  default_low_stock_threshold: number | string;
  created_at: string;
  updated_at: string;
};

type AuditEvent = {
  id: string;
  business_id: string;
  actor_id: string | null;
  actor_label: string;
  action: "created" | "updated" | "deleted" | "archived" | "restored";
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
};

type RecordCounts = {
  transactions: number;
  suppliers: number;
  supplierInvoices: number;
  inventoryItems: number;
  inventoryMovements: number;
  sales: number;
  costCategories: number;
  costCentres: number;
};

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function imageExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (
    extension === "png" ||
    extension === "jpg" ||
    extension === "jpeg" ||
    extension === "webp"
  ) {
    return extension === "jpeg" ? "jpg" : extension;
  }
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function entityLabel(value: string) {
  return value
    .replace(/^business_/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function BusinessAdministration({
  userId,
  role,
  initialBusiness,
  initialSettings,
  initialAudit,
  counts,
}: {
  userId: string;
  role: string;
  initialBusiness: Business;
  initialSettings: AdministrationSettings;
  initialAudit: AuditEvent[];
  counts: RecordCounts;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [business, setBusiness] = useState(initialBusiness);
  const [settings, setSettings] = useState(initialSettings);
  const [audit, setAudit] = useState(initialAudit);
  const [auditSearch, setAuditSearch] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function publicAssetUrl(path: string | null) {
    if (!path) return "";
    return supabase.storage
      .from(BUSINESS_ASSET_BUCKET)
      .getPublicUrl(path).data.publicUrl;
  }

  useEffect(() => {
    setLogoPreview(publicAssetUrl(business.logo_path));
    setCoverPreview(publicAssetUrl(business.cover_image_path));
  }, [business.logo_path, business.cover_image_path]);

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    return () => {
      if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  useEffect(() => {
    return () => {
      if (coverPreview.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  useEffect(() => {
    const channel = supabase
      .channel(`business-administration-${business.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "business_audit_log",
          filter: `business_id=eq.${business.id}`,
        },
        () => {
          void refreshAudit();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [business.id, supabase]);

  function clearMessages() {
    setNotice("");
    setError("");
  }

  async function refreshAudit() {
    const { data, error: auditError } = await supabase
      .from("business_audit_log")
      .select(
        "id,business_id,actor_id,actor_label,action,entity_type,entity_id,summary,metadata,occurred_at",
      )
      .eq("business_id", business.id)
      .order("occurred_at", { ascending: false })
      .limit(100);

    if (!auditError) setAudit((data ?? []) as AuditEvent[]);
  }

  function selectImage(
    event: ChangeEvent<HTMLInputElement>,
    kind: "logo" | "cover",
  ) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    const maxBytes = kind === "logo" ? LOGO_MAX_BYTES : COVER_MAX_BYTES;
    const maxLabel = kind === "logo" ? "3 MB" : "5 MB";

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError("Use a PNG, JPG or WEBP image.");
      return;
    }
    if (file.size > maxBytes) {
      setError(`The ${kind} image must be ${maxLabel} or smaller.`);
      return;
    }

    clearMessages();
    const preview = URL.createObjectURL(file);
    if (kind === "logo") {
      setLogoFile(file);
      setLogoPreview(preview);
      setRemoveLogo(false);
    } else {
      setCoverFile(file);
      setCoverPreview(preview);
      setRemoveCover(false);
    }
  }

  function removeSelectedImage(kind: "logo" | "cover") {
    clearMessages();
    if (kind === "logo") {
      setLogoFile(null);
      setLogoPreview("");
      setRemoveLogo(true);
    } else {
      setCoverFile(null);
      setCoverPreview("");
      setRemoveCover(true);
    }
  }

  async function uploadBusinessAsset(
    kind: "logo" | "cover",
    file: File,
  ) {
    const path = `${userId}/${business.id}/${kind}/${Date.now()}-${crypto.randomUUID()}.${imageExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from(BUSINESS_ASSET_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) throw uploadError;
    return path;
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy("profile");
    clearMessages();
    const form = new FormData(event.currentTarget);
    let uploadedLogoPath: string | null = null;
    let uploadedCoverPath: string | null = null;

    try {
      if (logoFile) uploadedLogoPath = await uploadBusinessAsset("logo", logoFile);
      if (coverFile) uploadedCoverPath = await uploadBusinessAsset("cover", coverFile);

      const nextLogoPath = removeLogo
        ? null
        : uploadedLogoPath ?? business.logo_path;
      const nextCoverPath = removeCover
        ? null
        : uploadedCoverPath ?? business.cover_image_path;

      const { data, error: updateError } = await supabase.rpc(
        "update_business_workspace",
        {
          p_business_id: business.id,
          p_name: String(form.get("name") ?? "").trim(),
          p_legal_name: cleanText(form.get("legal_name")),
          p_business_type: String(form.get("business_type") ?? business.business_type),
          p_country_code: String(form.get("country_code") ?? business.country_code).toUpperCase(),
          p_base_currency: String(form.get("base_currency") ?? business.base_currency),
          p_fiscal_year_start_month: Number(form.get("fiscal_year_start_month") ?? business.fiscal_year_start_month),
          p_timezone: String(form.get("timezone") ?? business.timezone),
          p_tax_id: cleanText(form.get("tax_id")),
          p_contact_email: cleanText(form.get("contact_email")),
          p_contact_phone: cleanText(form.get("contact_phone")),
          p_website: cleanText(form.get("website")),
          p_address_line1: cleanText(form.get("address_line1")),
          p_address_line2: cleanText(form.get("address_line2")),
          p_city: cleanText(form.get("city")),
          p_postal_code: cleanText(form.get("postal_code")),
          p_logo_path: nextLogoPath,
          p_cover_image_path: nextCoverPath,
        },
      );

      if (updateError || !data) {
        throw updateError ?? new Error("The business profile could not be updated.");
      }

      const updated = data as Business;
      const oldPaths = [
        business.logo_path && business.logo_path !== updated.logo_path
          ? business.logo_path
          : null,
        business.cover_image_path &&
        business.cover_image_path !== updated.cover_image_path
          ? business.cover_image_path
          : null,
      ].filter((path): path is string => Boolean(path));

      if (oldPaths.length) {
        await supabase.storage.from(BUSINESS_ASSET_BUCKET).remove(oldPaths);
      }

      setBusiness(updated);
      setLogoFile(null);
      setCoverFile(null);
      setRemoveLogo(false);
      setRemoveCover(false);
      setNotice("Business profile and identity updated.");
      await refreshAudit();
      router.refresh();
    } catch (profileError) {
      const newPaths = [uploadedLogoPath, uploadedCoverPath].filter(
        (path): path is string => Boolean(path),
      );
      if (newPaths.length) {
        await supabase.storage.from(BUSINESS_ASSET_BUCKET).remove(newPaths);
      }
      setError(
        profileError instanceof Error
          ? profileError.message
          : "The business profile could not be updated.",
      );
    } finally {
      setBusy("");
    }
  }

  async function saveFinancialSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy("financial");
    clearMessages();
    const form = new FormData(event.currentTarget);

    const { data, error: settingsError } = await supabase.rpc(
      "update_business_administration_settings",
      {
        p_business_id: business.id,
        p_default_timezone: String(form.get("default_timezone") ?? "UTC"),
        p_date_format: String(form.get("date_format") ?? "DD/MM/YYYY"),
        p_number_format: String(form.get("number_format") ?? "de-DE"),
        p_default_payment_method: String(form.get("default_payment_method") ?? "Card"),
        p_default_payment_terms_days: Number(form.get("default_payment_terms_days") ?? 14),
        p_default_sales_tax_rate: Number(form.get("default_sales_tax_rate") ?? 0),
        p_invoice_prefix: String(form.get("invoice_prefix") ?? "INV"),
        p_next_invoice_number: Number(form.get("next_invoice_number") ?? 1),
        p_default_low_stock_threshold: Number(form.get("default_low_stock_threshold") ?? 0),
      },
    );

    if (settingsError || !data) {
      setError(settingsError?.message ?? "Financial setup could not be saved.");
      setBusy("");
      return;
    }

    const updated = data as AdministrationSettings;
    setSettings(updated);
    setBusiness((current) => ({
      ...current,
      timezone: updated.default_timezone,
    }));
    setNotice("Financial setup updated.");
    setBusy("");
    await refreshAudit();
    router.refresh();
  }

  function downloadAdministrationSummary() {
    const payload = {
      generated_at: new Date().toISOString(),
      business,
      financial_setup: settings,
      record_counts: counts,
      recent_audit: audit.slice(0, 25),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${business.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-administration-summary.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const filteredAudit = audit.filter((event) => {
    const query = auditSearch.trim().toLowerCase();
    if (!query) return true;
    return `${event.summary} ${event.actor_label} ${event.entity_type} ${event.action}`
      .toLowerCase()
      .includes(query);
  });

  const totalOperationalRecords =
    counts.transactions +
    counts.suppliers +
    counts.supplierInvoices +
    counts.inventoryItems +
    counts.inventoryMovements +
    counts.sales;

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <span>FICONTER BUSINESS</span>
          <h1>Administration</h1>
          <p>
            Control the active business profile, financial defaults, audit
            history and workspace status from one protected area.
          </p>
        </div>
        <div className={styles.heroIdentity}>
          {business.logo_path ? (
            <img src={publicAssetUrl(business.logo_path)} alt="" />
          ) : (
            <Building2 size={24} />
          )}
          <div>
            <strong>{business.name}</strong>
            <small>{role === "owner" ? "Business owner" : "Administrator"}</small>
          </div>
        </div>
      </header>

      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.layout}>
        <nav className={styles.adminNav} aria-label="Business administration">
          {TABS.map(([id, Icon, label]) => (
            <button
              key={id}
              className={activeTab === id ? styles.activeNav : ""}
              onClick={() => {
                setActiveTab(id);
                clearMessages();
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
          <div className={styles.futureArea}>
            <Users size={17} />
            <div>
              <strong>Team & Roles</strong>
              <small>Prepared as the next administration phase.</small>
            </div>
          </div>
        </nav>

        <main className={styles.content}>
          {activeTab === "profile" ? (
            <form className={styles.panel} onSubmit={saveProfile}>
              <div className={styles.panelHeading}>
                <div>
                  <span>BUSINESS IDENTITY</span>
                  <h2>Business Profile</h2>
                  <p>These details belong only to the active business.</p>
                </div>
                <ShieldCheck size={27} />
              </div>

              <section className={styles.identityEditor}>
                <div className={styles.coverEditor}>
                  <div className={styles.coverPreview}>
                    {coverPreview ? (
                      <img src={coverPreview} alt="Business cover preview" />
                    ) : (
                      <div><ImageIcon size={30} /><span>No cover image</span></div>
                    )}
                  </div>
                  <div className={styles.assetActions}>
                    <label className={styles.assetUpload}>
                      <ImagePlus size={16} />
                      {coverPreview ? "Replace cover" : "Upload cover"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => selectImage(event, "cover")}
                      />
                    </label>
                    {coverPreview ? (
                      <button type="button" onClick={() => removeSelectedImage("cover")}>
                        <Trash2 size={15} /> Remove
                      </button>
                    ) : null}
                  </div>
                  <small>Wide PNG, JPG or WEBP · maximum 5 MB</small>
                </div>

                <div className={styles.logoEditor}>
                  <div className={styles.logoPreview}>
                    {logoPreview ? (
                      <img src={logoPreview} alt="Business logo preview" />
                    ) : (
                      <Building2 size={31} />
                    )}
                  </div>
                  <div className={styles.assetActions}>
                    <label className={styles.assetUpload}>
                      <ImagePlus size={16} />
                      {logoPreview ? "Replace logo" : "Upload logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => selectImage(event, "logo")}
                      />
                    </label>
                    {logoPreview ? (
                      <button type="button" onClick={() => removeSelectedImage("logo")}>
                        <Trash2 size={15} /> Remove
                      </button>
                    ) : null}
                  </div>
                  <small>Square image · maximum 3 MB</small>
                </div>
              </section>

              <div className={styles.formGrid}>
                <label>Business name<input name="name" defaultValue={business.name} required minLength={2} /></label>
                <label>Legal name<input name="legal_name" defaultValue={business.legal_name ?? ""} /></label>
                <label>Business type<select name="business_type" defaultValue={business.business_type}>{BUSINESS_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
                <label>Country code<input name="country_code" defaultValue={business.country_code} maxLength={2} required /></label>
                <label>Base currency<select name="base_currency" defaultValue={business.base_currency}>{CURRENCY_CODES.map((code) => <option key={code} value={code}>{currencySymbol(code)} {code} — {currencyName(code)}</option>)}</select><small>Locked after financial activity begins.</small></label>
                <label>Financial year begins<select name="fiscal_year_start_month" defaultValue={String(business.fiscal_year_start_month)}>{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label>
                <label>Timezone<input name="timezone" defaultValue={business.timezone} required /></label>
                <label>Tax / VAT ID<input name="tax_id" defaultValue={business.tax_id ?? ""} /></label>
                <label>Contact email<input type="email" name="contact_email" defaultValue={business.contact_email ?? ""} /></label>
                <label>Contact phone<input name="contact_phone" defaultValue={business.contact_phone ?? ""} /></label>
                <label>Website<input name="website" defaultValue={business.website ?? ""} placeholder="https://" /></label>
                <label>Address line 1<input name="address_line1" defaultValue={business.address_line1 ?? ""} /></label>
                <label>Address line 2<input name="address_line2" defaultValue={business.address_line2 ?? ""} /></label>
                <label>City<input name="city" defaultValue={business.city ?? ""} /></label>
                <label>Postal code<input name="postal_code" defaultValue={business.postal_code ?? ""} /></label>
              </div>

              <button className={styles.primaryButton} disabled={busy === "profile"}>
                <Save size={17} /> {busy === "profile" ? "Saving profile…" : "Save business profile"}
              </button>
            </form>
          ) : null}

          {activeTab === "financial" ? (
            <form className={styles.panel} onSubmit={saveFinancialSetup}>
              <div className={styles.panelHeading}>
                <div>
                  <span>CONTROL DEFAULTS</span>
                  <h2>Financial Setup</h2>
                  <p>Configure the defaults used to standardize this workspace.</p>
                </div>
                <Landmark size={27} />
              </div>

              <div className={styles.formGrid}>
                <label>Default timezone<input name="default_timezone" defaultValue={settings.default_timezone} required /></label>
                <label>Date format<select name="date_format" defaultValue={settings.date_format}><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select></label>
                <label>Number format<select name="number_format" defaultValue={settings.number_format}><option value="de-DE">1.234,56 — Germany</option><option value="en-GB">1,234.56 — United Kingdom</option><option value="en-US">1,234.56 — United States</option><option value="fr-FR">1 234,56 — France</option></select></label>
                <label>Default payment method<input name="default_payment_method" defaultValue={settings.default_payment_method} maxLength={60} /></label>
                <label>Default payment terms<input type="number" name="default_payment_terms_days" defaultValue={settings.default_payment_terms_days} min={0} max={365} /><small>Number of days.</small></label>
                <label>Default sales tax / VAT<input type="number" name="default_sales_tax_rate" defaultValue={String(settings.default_sales_tax_rate)} min={0} max={100} step="0.01" /><small>Percentage, for example 19.</small></label>
                <label>Invoice prefix<input name="invoice_prefix" defaultValue={settings.invoice_prefix} maxLength={20} /></label>
                <label>Next invoice number<input type="number" name="next_invoice_number" defaultValue={settings.next_invoice_number} min={1} step={1} /></label>
                <label>Default low-stock threshold<input type="number" name="default_low_stock_threshold" defaultValue={String(settings.default_low_stock_threshold)} min={0} step="0.001" /></label>
              </div>

              <div className={styles.masterDataGrid}>
                <article><Tags size={20} /><div><strong>{counts.costCategories}</strong><span>Cost categories</span></div><Link href="/business/cost-control">Manage</Link></article>
                <article><WalletCards size={20} /><div><strong>{counts.costCentres}</strong><span>Cost centres</span></div><Link href="/business/cost-control">Manage</Link></article>
              </div>

              <button className={styles.primaryButton} disabled={busy === "financial"}>
                <Save size={17} /> {busy === "financial" ? "Saving setup…" : "Save financial setup"}
              </button>
            </form>
          ) : null}

          {activeTab === "audit" ? (
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <span>ACCOUNTABILITY</span>
                  <h2>Audit Log</h2>
                  <p>The latest 100 important actions recorded for this business.</p>
                </div>
                <button className={styles.secondaryButton} onClick={() => void refreshAudit()}>
                  <RefreshCw size={16} /> Refresh
                </button>
              </div>

              <input
                className={styles.auditSearch}
                value={auditSearch}
                onChange={(event) => setAuditSearch(event.target.value)}
                placeholder="Search actions, people or records"
              />

              <div className={styles.auditList}>
                {filteredAudit.length ? filteredAudit.map((event) => (
                  <article key={event.id}>
                    <div className={`${styles.auditIcon} ${styles[event.action]}`}><Activity size={17} /></div>
                    <div>
                      <strong>{event.summary}</strong>
                      <span>{entityLabel(event.entity_type)} · {event.actor_label || "System"}</span>
                    </div>
                    <time><Clock3 size={14} /> {formatDateTime(event.occurred_at)}</time>
                  </article>
                )) : (
                  <div className={styles.emptyState}><FileClock size={35} /><h3>No matching audit activity</h3><p>New business actions will appear here automatically.</p></div>
                )}
              </div>
            </section>
          ) : null}

          {activeTab === "data" ? (
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <span>WORKSPACE CONTROL</span>
                  <h2>Data & Status</h2>
                  <p>Review the records isolated inside this business workspace.</p>
                </div>
                <Database size={27} />
              </div>

              <div className={styles.statusCard}>
                <div className={styles.statusIcon}>{business.status === "active" ? <CheckCircle2 size={24} /> : <Archive size={24} />}</div>
                <div><span>Workspace status</span><strong>{business.status === "active" ? "Active" : "Archived"}</strong><small>Business ID: {business.id}</small></div>
                <div><span>Operational records</span><strong>{totalOperationalRecords}</strong><small>Counts shown below</small></div>
              </div>

              <div className={styles.countGrid}>
                <article><WalletCards /><span>Transactions</span><strong>{counts.transactions}</strong></article>
                <article><Truck /><span>Suppliers</span><strong>{counts.suppliers}</strong></article>
                <article><ReceiptText /><span>Supplier invoices</span><strong>{counts.supplierInvoices}</strong></article>
                <article><PackageOpen /><span>Inventory items</span><strong>{counts.inventoryItems}</strong></article>
                <article><RefreshCw /><span>Stock movements</span><strong>{counts.inventoryMovements}</strong></article>
                <article><ShoppingCart /><span>Sales</span><strong>{counts.sales}</strong></article>
              </div>

              <div className={styles.dataActions}>
                <button className={styles.secondaryButton} onClick={downloadAdministrationSummary}>
                  <Download size={17} /> Download administration summary
                </button>
                <Link href="/business/manage" className={styles.dangerLink}>
                  <Archive size={17} /> Archive or permanently remove business
                </Link>
              </div>

              <div className={styles.assurance}>
                <ShieldCheck size={20} />
                <div><strong>Business data remains isolated</strong><p>Personal finances and other business workspaces are not included in these counts or administration controls.</p></div>
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </section>
  );
}
