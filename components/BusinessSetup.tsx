"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CURRENCY_CODES, currencyName, currencySymbol } from "@/lib/financialOptions";
import { useVault } from "@/components/VaultProvider";
import { initializeBusinessVaultForOwner } from "@/components/BusinessVaultProvider";
import { encryptBusinessPayload } from "@/lib/e2ee/businessVault";
import styles from "./BusinessSetup.module.css";

const BUSINESS_TYPES = [
  "Sole trader", "Freelancer", "Partnership", "Limited company", "Retail business",
  "Restaurant / hospitality", "Creative studio", "Online business", "Other",
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
  const { status: vaultStatus, vaultKey } = useVault();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (vaultStatus !== "unlocked" || !vaultKey) {
      setError("Unlock your Financial Vault before creating an encrypted business workspace.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();
      const legalName = String(form.get("legal_name") ?? "").trim() || null;
      const businessType = String(form.get("business_type") ?? "Sole trader");
      const countryCode = String(form.get("country_code") ?? "DE").toUpperCase();
      const baseCurrency = String(form.get("base_currency") ?? "EUR");
      const fiscalMonth = Number(form.get("fiscal_year_start_month") ?? 1);
      const timezone = browserTimezone();

      const { data, error: createError } = await supabase.rpc("create_business_workspace", {
        p_name: name,
        p_legal_name: undefined,
        p_business_type: businessType,
        p_country_code: countryCode,
        p_base_currency: baseCurrency,
        p_fiscal_year_start_month: fiscalMonth,
        p_timezone: timezone,
      });
      if (createError || !data) throw createError ?? new Error("The business workspace could not be created.");
      const businessId = typeof data === "string" ? data : String((data as any).id ?? (data as any).business_id ?? "");
      if (!businessId) throw new Error("The new business workspace id was not returned.");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw userError ?? new Error("The signed-in account could not be resolved.");

      const businessKey = await initializeBusinessVaultForOwner(
        supabase,
        vaultKey,
        userData.user.id,
        businessId,
      );

      const encryptedProfile = await encryptBusinessPayload(
        businessKey,
        businessId,
        "business-profile",
        businessId,
        {
          legal_name: legalName,
          tax_id: null,
          contact_email: null,
          contact_phone: null,
          website: null,
          address_line1: null,
          address_line2: null,
          city: null,
          postal_code: null,
        },
      );
      const { error: privateError } = await supabase.rpc("update_business_workspace_e2ee", {
        p_business_id: businessId,
        p_name: name,
        p_business_type: businessType,
        p_country_code: countryCode,
        p_base_currency: baseCurrency,
        p_fiscal_year_start_month: fiscalMonth,
        p_timezone: timezone,
        p_logo_path: null,
        p_cover_image_path: null,
        p_encrypted_payload: encryptedProfile,
        p_expected_revision: 0,
      });
      if (privateError) throw privateError;

      const encryptedSettings = await encryptBusinessPayload(
        businessKey,
        businessId,
        "business-settings",
        businessId,
        {
          default_timezone: timezone,
          date_format: "DD/MM/YYYY",
          number_format: "de-DE",
          default_payment_method: "Card",
          default_payment_terms_days: 14,
          default_sales_tax_rate: 0,
          invoice_prefix: "INV",
          next_invoice_number: 1,
          default_low_stock_threshold: 0,
        },
      );
      const { error: settingsError } = await supabase.rpc(
        "update_business_administration_settings_e2ee",
        {
          p_business_id: businessId,
          p_encrypted_payload: encryptedSettings,
          p_expected_revision: 0,
        },
      );
      if (settingsError) throw settingsError;

      router.replace("/business/overview");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The business workspace could not be created.");
      setSaving(false);
    }
  }

  return (
    <section className={styles.shell}>
      <div className={styles.intro}>
        <span className={styles.eyebrow}>FICONTER BUSINESS</span>
        <h1>Create your business workspace</h1>
        <p>Business records remain isolated from your personal finances and from every other business workspace you create.</p>
        <div className={styles.assurance}><ShieldCheck size={18} /><span>Protected with Business Vault encryption and membership access.</span></div>
      </div>
      <form className={styles.card} onSubmit={createBusiness}>
        <div className={styles.cardTitle}><Building2 /><div><span>BUSINESS PROFILE</span><h2>Workspace details</h2></div></div>
        <div className={styles.grid}>
          <label>Business name<input name="name" required minLength={2} placeholder="Enter business name" /></label>
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
