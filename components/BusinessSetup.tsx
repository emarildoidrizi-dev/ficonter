"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CURRENCY_CODES, currencyName, currencySymbol } from "@/lib/financialOptions";
import styles from "./BusinessSetup.module.css";

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
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function browserTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
}

export function BusinessSetup() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const { data, error: createError } = await supabase.rpc(
      "create_business_workspace",
      {
        p_name: String(form.get("name") ?? "").trim(),
        p_legal_name: String(form.get("legal_name") ?? "").trim() || null,
        p_business_type: String(form.get("business_type") ?? "Sole trader"),
        p_country_code: String(form.get("country_code") ?? "DE").toUpperCase(),
        p_base_currency: String(form.get("base_currency") ?? "EUR"),
        p_fiscal_year_start_month: Number(form.get("fiscal_year_start_month") ?? 1),
        p_timezone: browserTimezone(),
      },
    );

    if (createError || !data) {
      setError(createError?.message ?? "The business workspace could not be created.");
      setSaving(false);
      return;
    }

    router.replace("/business/overview");
    router.refresh();
  }

  return (
    <section className={styles.shell}>
      <div className={styles.intro}>
        <span className={styles.eyebrow}>FICONTER BUSINESS</span>
        <h1>Create your business workspace</h1>
        <p>
          Business records remain isolated from your personal finances and
          from every other business workspace you create.
        </p>
        <div className={styles.assurance}>
          <ShieldCheck size={18} />
          <span>Protected with business membership access and Supabase RLS.</span>
        </div>
      </div>

      <form className={styles.card} onSubmit={createBusiness}>
        <div className={styles.cardTitle}>
          <Building2 />
          <div><span>BUSINESS PROFILE</span><h2>Workspace details</h2></div>
        </div>
        <div className={styles.grid}>
          <label>Business name<input name="name" required minLength={2} placeholder="e.g. OTTE DOREZZI" /></label>
          <label>Legal name<input name="legal_name" placeholder="Optional registered name" /></label>
          <label>Business type<select name="business_type" defaultValue="Sole trader">{BUSINESS_TYPES.map(type=><option key={type}>{type}</option>)}</select></label>
          <label>Country code<input name="country_code" defaultValue="DE" maxLength={2} required /></label>
          <label>Base currency<select name="base_currency" defaultValue="EUR">{CURRENCY_CODES.map(code=><option key={code} value={code}>{currencySymbol(code)} {code} — {currencyName(code)}</option>)}</select></label>
          <label>Financial year begins<select name="fiscal_year_start_month" defaultValue="1">{MONTHS.map((month,index)=><option key={month} value={index+1}>{month}</option>)}</select></label>
        </div>
        {error ? <div className={styles.error} role="alert">{error}</div> : null}
        <button disabled={saving}>{saving ? "Creating workspace…" : "Create business workspace"}</button>
      </form>
    </section>
  );
}
