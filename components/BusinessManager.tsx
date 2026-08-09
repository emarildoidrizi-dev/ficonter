"use client";

import {
  Archive,
  Building2,
  Check,
  CirclePlus,
  Crown,
  Edit3,
  ImageIcon,
  ImagePlus,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CURRENCY_CODES,
  currencyName,
  currencySymbol,
} from "@/lib/financialOptions";
import type { Business } from "@/lib/business/types";
import { AutoFitSingleLineText } from "@/components/AutoFitSingleLineText";
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

const BUSINESS_ASSET_BUCKET = "business-assets";
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const LOGO_MAX_BYTES = 3 * 1024 * 1024;
const COVER_MAX_BYTES = 5 * 1024 * 1024;

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

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function imageExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "png" || extension === "jpg" || extension === "jpeg" || extension === "webp") {
    return extension === "jpeg" ? "jpg" : extension;
  }
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
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
  const [currentBusinessId, setCurrentBusinessId] =
    useState(activeBusinessId);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "archived"
  >("all");
  const [showCreateForm, setShowCreateForm] = useState(
    initialBusinesses.length === 0,
  );
  const [editingBusiness, setEditingBusiness] =
    useState<Business | null>(null);
  const [archivingBusiness, setArchivingBusiness] =
    useState<Business | null>(null);
  const [deletingBusiness, setDeletingBusiness] =
    useState<Business | null>(null);
  const [confirmationName, setConfirmationName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!notice) return;

    const timeoutId = window.setTimeout(() => {
      setNotice("");
    }, 5000);

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

  function publicAssetUrl(path: string | null) {
    if (!path) return "";
    return supabase.storage
      .from(BUSINESS_ASSET_BUCKET)
      .getPublicUrl(path).data.publicUrl;
  }

  function closeEditBusiness() {
    setEditingBusiness(null);
    setLogoFile(null);
    setCoverFile(null);
    setLogoPreview("");
    setCoverPreview("");
    setRemoveLogo(false);
    setRemoveCover(false);
    clearMessages();
  }

  function beginEditBusiness(business: Business) {
    setEditingBusiness(business);
    setLogoFile(null);
    setCoverFile(null);
    setLogoPreview(publicAssetUrl(business.logo_path));
    setCoverPreview(publicAssetUrl(business.cover_image_path));
    setRemoveLogo(false);
    setRemoveCover(false);
    clearMessages();
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
    businessId: string,
    kind: "logo" | "cover",
    file: File,
  ) {
    const path = `${userId}/${businessId}/${kind}/${Date.now()}-${crypto.randomUUID()}.${imageExtension(file)}`;
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

  const activeCount = businesses.filter(
    (business) => business.status !== "archived",
  ).length;
  const archivedCount = businesses.length - activeCount;
  const visibleBusinesses = businesses.filter(
    (business) =>
      statusFilter === "all" || business.status === statusFilter,
  );

  function clearMessages() {
    setNotice("");
    setError("");
  }

  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy("create");
    clearMessages();

    const form = new FormData(event.currentTarget);
    const { data, error: createError } = await supabase.rpc(
      "create_business_workspace",
      {
        p_name: String(form.get("name") ?? "").trim(),
        p_legal_name: cleanText(form.get("legal_name")),
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

  async function saveBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingBusiness || busy) return;

    setBusy(`edit-${editingBusiness.id}`);
    clearMessages();

    const form = new FormData(event.currentTarget);
    let uploadedLogoPath: string | null = null;
    let uploadedCoverPath: string | null = null;

    try {
      if (logoFile) {
        uploadedLogoPath = await uploadBusinessAsset(
          editingBusiness.id,
          "logo",
          logoFile,
        );
      }

      if (coverFile) {
        uploadedCoverPath = await uploadBusinessAsset(
          editingBusiness.id,
          "cover",
          coverFile,
        );
      }

      const nextLogoPath = removeLogo
        ? null
        : uploadedLogoPath ?? editingBusiness.logo_path;
      const nextCoverPath = removeCover
        ? null
        : uploadedCoverPath ?? editingBusiness.cover_image_path;

      const { data, error: updateError } = await supabase.rpc(
        "update_business_workspace",
        {
          p_business_id: editingBusiness.id,
          p_name: String(form.get("name") ?? "").trim(),
          p_legal_name: cleanText(form.get("legal_name")),
          p_business_type: String(
            form.get("business_type") ?? editingBusiness.business_type,
          ),
          p_country_code: String(
            form.get("country_code") ?? editingBusiness.country_code,
          ).toUpperCase(),
          p_base_currency: String(
            form.get("base_currency") ?? editingBusiness.base_currency,
          ),
          p_fiscal_year_start_month: Number(
            form.get("fiscal_year_start_month") ??
              editingBusiness.fiscal_year_start_month,
          ),
          p_timezone: String(
            form.get("timezone") ?? editingBusiness.timezone,
          ),
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
        throw updateError ?? new Error(
          "The business profile could not be updated.",
        );
      }

      const updated = data as Business;
      const oldPathsToRemove = [
        editingBusiness.logo_path &&
        editingBusiness.logo_path !== updated.logo_path
          ? editingBusiness.logo_path
          : null,
        editingBusiness.cover_image_path &&
        editingBusiness.cover_image_path !== updated.cover_image_path
          ? editingBusiness.cover_image_path
          : null,
      ].filter((path): path is string => Boolean(path));

      let cleanupWarning = false;
      if (oldPathsToRemove.length) {
        const { error: cleanupError } = await supabase.storage
          .from(BUSINESS_ASSET_BUCKET)
          .remove(oldPathsToRemove);
        cleanupWarning = Boolean(cleanupError);
      }

      setBusinesses((current) =>
        current.map((business) =>
          business.id === updated.id ? updated : business,
        ),
      );
      closeEditBusiness();
      setNotice(
        cleanupWarning
          ? "Business profile updated. The previous image could not be cleaned up automatically."
          : "Business profile and identity updated.",
      );
      router.refresh();
    } catch (saveError) {
      const uploadedPaths = [
        uploadedLogoPath,
        uploadedCoverPath,
      ].filter((path): path is string => Boolean(path));

      if (uploadedPaths.length) {
        await supabase.storage
          .from(BUSINESS_ASSET_BUCKET)
          .remove(uploadedPaths);
      }

      setError(
        saveError instanceof Error
          ? saveError.message
          : "The business profile could not be updated.",
      );
    } finally {
      setBusy("");
    }
  }

  async function openBusiness(businessId: string) {
    if (busy) return;

    if (businessId === currentBusinessId) {
      router.replace("/business/overview");
      return;
    }

    setBusy(`switch-${businessId}`);
    clearMessages();

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
    router.prefetch("/business/overview");
    router.replace("/business/overview");
  }

  function cardClickIsOnControl(target: EventTarget | null) {
    return (
      target instanceof Element &&
      Boolean(
        target.closest(
          "button, a, input, select, textarea, label, [role='button']",
        ),
      )
    );
  }

  function handleBusinessCardClick(
    event: MouseEvent<HTMLElement>,
    business: Business,
  ) {
    if (
      business.status === "archived" ||
      cardClickIsOnControl(event.target)
    ) {
      return;
    }

    void openBusiness(business.id);
  }

  function handleBusinessCardKeyDown(
    event: KeyboardEvent<HTMLElement>,
    business: Business,
  ) {
    if (
      business.status === "archived" ||
      event.target !== event.currentTarget
    ) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void openBusiness(business.id);
    }
  }

  async function confirmArchiveBusiness() {
    if (!archivingBusiness || busy) return;

    setBusy(`archive-${archivingBusiness.id}`);
    clearMessages();

    const { data, error: archiveError } = await supabase.rpc(
      "archive_business_workspace",
      { p_business_id: archivingBusiness.id },
    );

    if (archiveError) {
      setError(archiveError.message);
      setBusy("");
      return;
    }

    const result = data as {
      business?: Business;
      active_business_id?: string | null;
    } | null;

    if (!result?.business) {
      setError("The archived business was not returned.");
      setBusy("");
      return;
    }

    setBusinesses((current) =>
      current.map((business) =>
        business.id === result.business!.id
          ? result.business!
          : business,
      ),
    );
    setCurrentBusinessId(result.active_business_id ?? null);
    setArchivingBusiness(null);
    setBusy("");
    setNotice(
      "Business archived. Its records remain stored and can be restored.",
    );

    if (result.active_business_id) {
      router.replace("/business/overview");
    } else {
      router.replace("/business/manage");
    }
    router.refresh();
  }

  async function restoreBusiness(business: Business) {
    if (busy) return;

    setBusy(`restore-${business.id}`);
    clearMessages();

    const { data, error: restoreError } = await supabase.rpc(
      "restore_business_workspace",
      { p_business_id: business.id },
    );

    if (restoreError) {
      setError(restoreError.message);
      setBusy("");
      return;
    }

    const result = data as {
      business?: Business;
      active_business_id?: string | null;
    } | null;

    if (!result?.business) {
      setError("The restored business was not returned.");
      setBusy("");
      return;
    }

    setBusinesses((current) =>
      current.map((item) =>
        item.id === result.business!.id ? result.business! : item,
      ),
    );
    setCurrentBusinessId(result.active_business_id ?? business.id);
    setBusy("");
    setNotice("Business restored and opened.");
    router.replace("/business/overview");
    router.refresh();
  }

  function beginDelete(business: Business) {
    setDeletingBusiness(business);
    setConfirmationName("");
    clearMessages();
  }

  async function confirmDeleteBusiness() {
    if (!deletingBusiness || busy) return;

    if (confirmationName.trim() !== deletingBusiness.name) {
      setError("Type the exact business name to confirm deletion.");
      return;
    }

    setBusy(`delete-${deletingBusiness.id}`);
    clearMessages();

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

    const deletedAssetPaths = [
      deletingBusiness.logo_path,
      deletingBusiness.cover_image_path,
    ].filter((path): path is string => Boolean(path));
    let assetCleanupWarning = false;

    if (deletedAssetPaths.length) {
      const { error: assetCleanupError } = await supabase.storage
        .from(BUSINESS_ASSET_BUCKET)
        .remove(deletedAssetPaths);
      assetCleanupWarning = Boolean(assetCleanupError);
    }

    setBusinesses((current) =>
      current.filter((item) => item.id !== deletedId),
    );
    setCurrentBusinessId(nextActiveId);
    setDeletingBusiness(null);
    setConfirmationName("");
    setBusy("");

    if (nextActiveId) {
      setNotice(
        assetCleanupWarning
          ? "Business removed. One stored image may require later cleanup."
          : "Business removed. Another business is now active.",
      );
      router.replace("/business/overview");
    } else {
      if (assetCleanupWarning) {
        setNotice(
          "Business removed. One stored image may require later cleanup.",
        );
      }
      router.replace("/business/manage");
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
            Create, edit, archive, restore and safely remove separate business
            workspaces without mixing their financial records.
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreateForm((current) => !current);
            clearMessages();
          }}
        >
          {showCreateForm ? <X size={18} /> : <Plus size={18} />}
          {showCreateForm ? "Close form" : "Add business"}
        </button>
      </header>

      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error &&
      !editingBusiness &&
      !archivingBusiness &&
      !deletingBusiness ? (
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
          <span>Active businesses</span>
          <strong>{activeCount}</strong>
        </article>
        <article>
          <Archive />
          <span>Archived businesses</span>
          <strong>{archivedCount}</strong>
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
                placeholder="Enter business name"
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

      <div className={styles.filters}>
        <button
          className={statusFilter === "all" ? styles.activeFilter : ""}
          onClick={() => setStatusFilter("all")}
        >
          All
        </button>
        <button
          className={statusFilter === "active" ? styles.activeFilter : ""}
          onClick={() => setStatusFilter("active")}
        >
          Active
        </button>
        <button
          className={statusFilter === "archived" ? styles.activeFilter : ""}
          onClick={() => setStatusFilter("archived")}
        >
          Archived
        </button>
      </div>

      <div className={styles.businessGrid}>
        {visibleBusinesses.length ? (
          visibleBusinesses.map((business) => {
            const isActiveWorkspace = business.id === currentBusinessId;
            const isArchived = business.status === "archived";
            const isOwner = business.owner_id === userId;
            const logoUrl = publicAssetUrl(business.logo_path);
            const coverUrl = publicAssetUrl(business.cover_image_path);

            return (
              <article
                className={`${styles.businessCard} ${
                  isActiveWorkspace ? styles.activeCard : ""
                } ${isArchived ? styles.archivedCard : ""}`}
                key={business.id}
                role={isArchived ? undefined : "button"}
                tabIndex={isArchived ? undefined : 0}
                aria-label={
                  isArchived
                    ? undefined
                    : `Open ${business.name} business`
                }
                onClick={(event) =>
                  handleBusinessCardClick(event, business)
                }
                onKeyDown={(event) =>
                  handleBusinessCardKeyDown(event, business)
                }
              >
                <div className={styles.cardMedia}>
                  {coverUrl ? (
                    <img
                      className={styles.cardCover}
                      src={coverUrl}
                      alt={`${business.name} cover`}
                    />
                  ) : (
                    <div className={styles.cardCoverFallback}>
                      <ImageIcon size={27} />
                    </div>
                  )}
                </div>

                <div className={styles.cardHeader}>
                  <div className={styles.businessIcon}>
                    {logoUrl ? (
                      <img
                        className={styles.cardLogo}
                        src={logoUrl}
                        alt={`${business.name} logo`}
                      />
                    ) : isArchived ? (
                      <Archive size={22} />
                    ) : (
                      <Building2 size={22} />
                    )}
                  </div>
                  <div>
                    <div className={styles.nameRow}>
                      <AutoFitSingleLineText text={business.name} as="h2" minSize={8} maxSize={21} safetyMargin={12} />
                      {isActiveWorkspace ? (
                        <span className={styles.activeBadge}>
                          <Check size={13} /> Active workspace
                        </span>
                      ) : null}
                      {isArchived ? (
                        <span className={styles.archivedBadge}>
                          <Archive size={13} /> Archived
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
                  <div>
                    <span>Timezone</span>
                    <strong>{business.timezone || "UTC"}</strong>
                  </div>
                  <div>
                    <span>Contact</span>
                    <strong>
                      {business.contact_email ||
                        business.contact_phone ||
                        "Not added"}
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
                  {!isArchived ? (
                    <button
                      className={styles.openButton}
                      onClick={() => openBusiness(business.id)}
                      disabled={
                        isActiveWorkspace ||
                        busy === `switch-${business.id}`
                      }
                    >
                      {isActiveWorkspace
                        ? "Currently active"
                        : busy === `switch-${business.id}`
                          ? "Opening…"
                          : "Open"}
                    </button>
                  ) : (
                    <button
                      className={styles.restoreButton}
                      onClick={() => restoreBusiness(business)}
                      disabled={busy === `restore-${business.id}`}
                    >
                      <RotateCcw size={16} />
                      {busy === `restore-${business.id}`
                        ? "Restoring…"
                        : "Restore"}
                    </button>
                  )}

                  {isOwner ? (
                    <>
                      <button
                        className={styles.editButton}
                        onClick={() => beginEditBusiness(business)}
                      >
                        <Edit3 size={16} />
                        Edit
                      </button>

                      {!isArchived ? (
                        <button
                          className={styles.archiveButton}
                          onClick={() => {
                            setArchivingBusiness(business);
                            clearMessages();
                          }}
                        >
                          <Archive size={16} />
                          Archive
                        </button>
                      ) : null}

                      <button
                        className={styles.deleteButton}
                        onClick={() => beginDelete(business)}
                      >
                        <Trash2 size={16} />
                        Remove
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <Building2 size={38} />
            <h2>No businesses in this view</h2>
            <p>Change the filter or create another workspace.</p>
          </div>
        )}
      </div>

      {editingBusiness ? (
        <div className={styles.backdrop}>
          <form className={styles.modalWide} onSubmit={saveBusiness}>
            <button
              type="button"
              className={styles.modalClose}
              onClick={closeEditBusiness}
              aria-label="Close edit business"
            >
              <X size={19} />
            </button>

            <Edit3 className={styles.modalIcon} />
            <span>EDIT BUSINESS</span>
            <h2>{editingBusiness.name}</h2>

            <section className={styles.identityEditor}>
              <div className={styles.coverEditor}>
                <div className={styles.coverPreview}>
                  {coverPreview ? (
                    <img src={coverPreview} alt="Business cover preview" />
                  ) : (
                    <div>
                      <ImageIcon size={30} />
                      <span>No cover image</span>
                    </div>
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
                    <button
                      type="button"
                      className={styles.assetRemove}
                      onClick={() => removeSelectedImage("cover")}
                    >
                      <Trash2 size={15} />
                      Remove
                    </button>
                  ) : null}
                </div>
                <small>Wide image · PNG, JPG or WEBP · maximum 5 MB</small>
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
                    <button
                      type="button"
                      className={styles.assetRemove}
                      onClick={() => removeSelectedImage("logo")}
                    >
                      <Trash2 size={15} />
                      Remove
                    </button>
                  ) : null}
                </div>
                <small>Square image · transparent PNG preferred · maximum 3 MB</small>
              </div>
            </section>

            <div className={styles.formGrid}>
              <label>
                Business name
                <input
                  name="name"
                  defaultValue={editingBusiness.name}
                  required
                  minLength={2}
                />
              </label>
              <label>
                Legal name
                <input
                  name="legal_name"
                  defaultValue={editingBusiness.legal_name ?? ""}
                />
              </label>
              <label>
                Business type
                <select
                  name="business_type"
                  defaultValue={editingBusiness.business_type}
                >
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Country code
                <input
                  name="country_code"
                  defaultValue={editingBusiness.country_code}
                  maxLength={2}
                  required
                />
              </label>
              <label>
                Base currency
                <select
                  name="base_currency"
                  defaultValue={editingBusiness.base_currency}
                >
                  {CURRENCY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {currencySymbol(code)} {code} — {currencyName(code)}
                    </option>
                  ))}
                </select>
                <small>
                  Locked after financial activity begins.
                </small>
              </label>
              <label>
                Financial year begins
                <select
                  name="fiscal_year_start_month"
                  defaultValue={String(
                    editingBusiness.fiscal_year_start_month,
                  )}
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Timezone
                <input
                  name="timezone"
                  defaultValue={
                    editingBusiness.timezone || browserTimezone()
                  }
                  required
                />
              </label>
              <label>
                Tax / VAT ID
                <input
                  name="tax_id"
                  defaultValue={editingBusiness.tax_id ?? ""}
                />
              </label>
              <label>
                Contact email
                <input
                  type="email"
                  name="contact_email"
                  defaultValue={editingBusiness.contact_email ?? ""}
                />
              </label>
              <label>
                Contact phone
                <input
                  name="contact_phone"
                  defaultValue={editingBusiness.contact_phone ?? ""}
                />
              </label>
              <label>
                Website
                <input
                  name="website"
                  defaultValue={editingBusiness.website ?? ""}
                  placeholder="https://"
                />
              </label>
              <label>
                Address line 1
                <input
                  name="address_line1"
                  defaultValue={editingBusiness.address_line1 ?? ""}
                />
              </label>
              <label>
                Address line 2
                <input
                  name="address_line2"
                  defaultValue={editingBusiness.address_line2 ?? ""}
                />
              </label>
              <label>
                City
                <input
                  name="city"
                  defaultValue={editingBusiness.city ?? ""}
                />
              </label>
              <label>
                Postal code
                <input
                  name="postal_code"
                  defaultValue={editingBusiness.postal_code ?? ""}
                />
              </label>
            </div>

            {error ? <div className={styles.error}>{error}</div> : null}

            <button
              className={styles.primaryButton}
              disabled={busy === `edit-${editingBusiness.id}`}
            >
              {busy === `edit-${editingBusiness.id}`
                ? "Saving changes…"
                : "Save changes"}
            </button>
          </form>
        </div>
      ) : null}

      {archivingBusiness ? (
        <div className={styles.backdrop}>
          <section className={styles.modal}>
            <button
              className={styles.modalClose}
              onClick={() => {
                setArchivingBusiness(null);
                clearMessages();
              }}
              aria-label="Close archive confirmation"
            >
              <X size={19} />
            </button>

            <Archive className={styles.modalIcon} />
            <span>ARCHIVE BUSINESS</span>
            <h2>Archive {archivingBusiness.name}?</h2>
            <p>
              The business will disappear from the active workspace selector.
              Its Transactions, Costs, Suppliers, Inventory, Sales and Reports
              remain stored. Automatic recurring costs are suspended while the
              business is archived.
            </p>

            {error ? <div className={styles.error}>{error}</div> : null}

            <div className={styles.modalActions}>
              <button
                onClick={() => {
                  setArchivingBusiness(null);
                  clearMessages();
                }}
              >
                Keep active
              </button>
              <button
                className={styles.archiveConfirm}
                onClick={confirmArchiveBusiness}
                disabled={
                  busy === `archive-${archivingBusiness.id}`
                }
              >
                {busy === `archive-${archivingBusiness.id}`
                  ? "Archiving…"
                  : "Archive business"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {deletingBusiness ? (
        <div className={styles.backdrop}>
          <section className={styles.modal}>
            <button
              className={styles.modalClose}
              onClick={() => {
                setDeletingBusiness(null);
                setConfirmationName("");
                clearMessages();
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
                  clearMessages();
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
