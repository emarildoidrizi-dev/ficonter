"use client";

import {
  Building2,
  Check,
  CirclePlus,
  Crown,
  Plus,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CURRENCY_CODES,
  currencyName,
  currencySymbol,
} from "@/lib/financialOptions";
import type { Business } from "@/lib/business/types";
import styles from "./BusinessManager.module.css";

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

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function BusinessManager({
  userId,
  initialBusinesses,
  activeBusinessId,
}: {
  userId: string;
  initialBusinesses: Business[];
  activeBusinessId: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [currentBusinessId, setCurrentBusinessId] = useState(activeBusinessId);
  const [showCreateForm, setShowCreateForm] = useState(initialBusinesses.length === 0);
  const [deletingBusiness, setDeletingBusiness] = useState<Business | null>(null);
  const [confirmationName, setConfirmationName] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy("create");
    setError("");
    setNotice("");

    const form = new FormData(event.currentTarget);
    const { data, error: createError } = await supabase.rpc(
      "create_business_workspace",
      {
        p_name: String(form.get("name") ?? "").trim(),
        p_legal_name:
          String(form.get("legal_name") ?? "").trim() || null,
        p_business_type: String(
          form.get("business_type") ?? "Sole trader",
        ),
        p_country_code: String(
          form.get("country_code") ?? "DE",
        ).toUpperCase(),
        p_base_currency: String(
          form.get("base_currency") ?? "EUR",
        ),
        p_fiscal_year_start_month: Number(
          form.get("fiscal_year_start_month") ?? 1,
        ),
        p_timezone: browserTimezone(),
      },
    );

    if (createError || !data) {
      setError(
        createError?.message ??
          "The additional business workspace could not be created.",
      );
      setBusy("");
      return;
    }

    router.replace("/business/overview");
    router.refresh();
  }

  async function openBusiness(businessId: string) {
    if (busy || businessId === currentBusinessId) return;

    setBusy(`switch-${businessId}`);
    setError("");
    setNotice("");

    const { error: switchError } = await supabase.rpc(
      "set_active_business_workspace",
      { p_business_id: businessId },
    );

    if (switchError) {
      setError(switchError.message);
      setBusy("");
      return;
    }

    setCurrentBusinessId(businessId);
    router.replace("/business/overview");
    router.refresh();
  }

  function beginDelete(business: Business) {
    setDeletingBusiness(business);
    setConfirmationName("");
    setError("");
    setNotice("");
  }

  async function confirmDeleteBusiness() {
    if (!deletingBusiness || busy) return;

    if (confirmationName.trim() !== deletingBusiness.name) {
      setError("Type the exact business name to confirm deletion.");
      return;
    }

    setBusy(`delete-${deletingBusiness.id}`);
    setError("");
    setNotice("");

    const { data, error: deleteError } = await supabase.rpc(
      "delete_business_workspace",
      {
        p_business_id: deletingBusiness.id,
        p_confirmation_name: confirmationName.trim(),
      },
    );

    if (deleteError) {
      setError(deleteError.message);
      setBusy("");
      return;
    }

    const result = data as {
      deleted_business_id?: string;
      active_business_id?: string | null;
    } | null;

    const deletedId =
      result?.deleted_business_id ?? deletingBusiness.id;
    const nextActiveId =
      typeof result?.active_business_id === "string"
        ? result.active_business_id
        : null;

    setBusinesses((current) =>
      current.filter((item) => item.id !== deletedId),
    );
    setCurrentBusinessId(nextActiveId);
    setDeletingBusiness(null);
    setConfirmationName("");
    setBusy("");

    if (nextActiveId) {
      setNotice("Business removed. Another business is now active.");
      router.replace("/business/overview");
    } else {
      router.replace("/business/setup");
    }
    router.refresh();
  }

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <span>FICONTER BUSINESS</span>
          <h1>Businesses</h1>
          <p>
            Create separate business workspaces and switch between them
            without mixing Transactions, Costs, Suppliers, Inventory, Sales
            or Reports.
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreateForm((current) => !current);
            setError("");
            setNotice("");
          }}
        >
          {showCreateForm ? <X size={18} /> : <Plus size={18} />}
          {showCreateForm ? "Close form" : "Add business"}
        </button>
      </header>

      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error && !deletingBusiness ? (
        <div className={styles.error}>{error}</div>
      ) : null}

      <div className={styles.summaryGrid}>
        <article>
          <Building2 />
          <span>Total businesses</span>
          <strong>{businesses.length}</strong>
        </article>
        <article>
          <Check />
          <span>Active workspace</span>
          <strong>
            {businesses.find((item) => item.id === currentBusinessId)?.name ??
              "None"}
          </strong>
        </article>
      </div>

      {showCreateForm ? (
        <form
          id="new-business"
          className={styles.formCard}
          onSubmit={createBusiness}
        >
          <div className={styles.formHeading}>
            <div>
              <span>NEW BUSINESS</span>
              <h2>Create another workspace</h2>
            </div>
            <CirclePlus size={27} />
          </div>

          <div className={styles.formGrid}>
            <label>
              Business name
              <input
                name="name"
                required
                minLength={2}
                placeholder="e.g. OTTE DOREZZI"
              />
            </label>
            <label>
              Legal name
              <input
                name="legal_name"
                placeholder="Optional registered name"
              />
            </label>
            <label>
              Business type
              <select name="business_type" defaultValue="Sole trader">
                {BUSINESS_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Country code
              <input
                name="country_code"
                defaultValue="DE"
                maxLength={2}
                required
              />
            </label>
            <label>
              Base currency
              <select name="base_currency" defaultValue="EUR">
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {currencySymbol(code)} {code} — {currencyName(code)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Financial year begins
              <select
                name="fiscal_year_start_month"
                defaultValue="1"
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.formAssurance}>
            <ShieldAlert size={17} />
            <span>
              The new workspace receives its own financial records and becomes
              the active business immediately.
            </span>
          </div>

          <button
            className={styles.primaryButton}
            disabled={busy === "create"}
          >
            {busy === "create"
              ? "Creating workspace…"
              : "Create business workspace"}
          </button>
        </form>
      ) : null}

      <div className={styles.businessGrid}>
        {businesses.length ? (
          businesses.map((business) => {
            const isActive = business.id === currentBusinessId;
            const isOwner = business.owner_id === userId;

            return (
              <article
                className={`${styles.businessCard} ${
                  isActive ? styles.activeCard : ""
                }`}
                key={business.id}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.businessIcon}>
                    <Building2 size={22} />
                  </div>
                  <div>
                    <div className={styles.nameRow}>
                      <h2>{business.name}</h2>
                      {isActive ? (
                        <span className={styles.activeBadge}>
                          <Check size={13} /> Active
                        </span>
                      ) : null}
                    </div>
                    <p>{business.legal_name || business.business_type}</p>
                  </div>
                </div>

                <div className={styles.details}>
                  <div>
                    <span>Business type</span>
                    <strong>{business.business_type}</strong>
                  </div>
                  <div>
                    <span>Country</span>
                    <strong>{business.country_code}</strong>
                  </div>
                  <div>
                    <span>Currency</span>
                    <strong>{business.base_currency}</strong>
                  </div>
                  <div>
                    <span>Financial year</span>
                    <strong>
                      {MONTHS[business.fiscal_year_start_month - 1]}
                    </strong>
                  </div>
                </div>

                <div className={styles.role}>
                  <Crown size={15} />
                  {isOwner
                    ? "You own this workspace"
                    : "Shared business workspace"}
                </div>

                <div className={styles.cardActions}>
                  <button
                    className={styles.openButton}
                    onClick={() => openBusiness(business.id)}
                    disabled={
                      isActive || busy === `switch-${business.id}`
                    }
                  >
                    {isActive
                      ? "Currently active"
                      : busy === `switch-${business.id}`
                        ? "Opening…"
                        : "Open business"}
                  </button>
                  {isOwner ? (
                    <button
                      className={styles.deleteButton}
                      onClick={() => beginDelete(business)}
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <Building2 size={38} />
            <h2>No business workspace</h2>
            <p>Create your first business to begin.</p>
          </div>
        )}
      </div>

      {deletingBusiness ? (
        <div className={styles.backdrop}>
          <section className={styles.modal}>
            <button
              className={styles.modalClose}
              onClick={() => {
                setDeletingBusiness(null);
                setConfirmationName("");
                setError("");
              }}
              aria-label="Close deletion confirmation"
            >
              <X size={19} />
            </button>

            <Trash2 className={styles.modalIcon} />
            <span>PERMANENT BUSINESS REMOVAL</span>
            <h2>Remove {deletingBusiness.name}?</h2>
            <p>
              This permanently deletes this business and all of its Business
              Transactions, Costs, Suppliers, Invoices, Inventory, Sales and
              Reports. Personal finances and other businesses are not affected.
            </p>

            <label className={styles.confirmationLabel}>
              Type <strong>{deletingBusiness.name}</strong> to confirm
              <input
                value={confirmationName}
                onChange={(event) =>
                  setConfirmationName(event.target.value)
                }
                autoComplete="off"
              />
            </label>

            {error ? <div className={styles.error}>{error}</div> : null}

            <div className={styles.modalActions}>
              <button
                onClick={() => {
                  setDeletingBusiness(null);
                  setConfirmationName("");
                  setError("");
                }}
              >
                Keep business
              </button>
              <button
                className={styles.modalDanger}
                onClick={confirmDeleteBusiness}
                disabled={
                  confirmationName.trim() !== deletingBusiness.name ||
                  busy === `delete-${deletingBusiness.id}`
                }
              >
                {busy === `delete-${deletingBusiness.id}`
                  ? "Removing…"
                  : "Remove permanently"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
