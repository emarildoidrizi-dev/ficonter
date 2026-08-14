"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ClipboardList,
  Clock3,
  ListChecks,
  Loader2,
  Repeat2,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import {
  createRecentPresets,
  currentPeriodKey,
  ENTRY_MODE_OPTIONS,
  isTemplateDueThisMonth,
  templateToPreset,
  type EntryMode,
  type TransactionForPreset,
  type TransactionPreset,
  type TransactionTemplate,
} from "@/lib/effortlessEntry";
import { formatCurrency } from "@/lib/financialOptions";
import { TransactionForm } from "./TransactionForm";
import styles from "./EffortlessEntryWorkspace.module.css";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  initialTransactions: TransactionForPreset[];
  initialType?: "expense" | "income" | "saving";
  allowMultiCurrency?: boolean;
};

type PostingRow = {
  template_id: string;
  period_key: string;
  transaction_id: string | null;
};

const ENTRY_MODE_PRESENTATION = {
  simple: {
    description: "Quick add with shortcuts.",
    badge: "10 sec",
    icon: Zap,
  },
  guided: {
    description: "Step-by-step flow.",
    badge: "30 sec",
    icon: ListChecks,
  },
  detailed: {
    description: "Full form with all fields.",
    badge: "Full",
    icon: ClipboardList,
  },
} as const;

function normalizeSavedTransaction(value: unknown) {
  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined;
  return value as Record<string, unknown> | null;
}

export function EffortlessEntryWorkspace({
  initialTransactions,
  initialType = "expense",
  allowMultiCurrency = true,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const quickAddRequestedRef = useRef(false);
  const formSectionRef = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState<EntryMode>("guided");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [templates, setTemplates] = useState<TransactionTemplate[]>([]);
  const [postedTemplateIds, setPostedTemplateIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [activePreset, setActivePreset] = useState<TransactionPreset | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [bulkPosting, setBulkPosting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const periodKey = useMemo(() => currentPeriodKey(), []);

  const activateQuickAdd = useCallback(() => {
    quickAddRequestedRef.current = true;
    setActivePreset(null);
    setMode("simple");

    window.setTimeout(() => {
      formSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      const amountInput = document.getElementById(
        "simple-amount",
      ) as HTMLInputElement | null;

      amountInput?.focus({ preventScroll: true });
      amountInput?.select();
    }, 160);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadEffortlessEntry() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!mounted) return;
      if (userError || !user) {
        setError("Please log in again.");
        setLoading(false);
        return;
      }

      const [preferencesResult, templatesResult, postingsResult] = await Promise.all([
        supabase
          .from("money_entry_preferences")
          .select("entry_mode")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("transaction_templates")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("updated_at", { ascending: false }),
        supabase
          .from("transaction_template_postings")
          .select("template_id,period_key,transaction_id")
          .eq("user_id", user.id)
          .eq("period_key", periodKey),
      ]);

      if (!mounted) return;

      const firstError =
        preferencesResult.error || templatesResult.error || postingsResult.error;
      if (firstError) {
        setError(
          firstError.message.includes("schema cache") ||
            firstError.message.includes("does not exist")
            ? "Effortless Entry needs its Supabase setup before shortcuts can be used."
            : firstError.message,
        );
      }

      const savedMode = preferencesResult.data?.entry_mode;
      if (quickAddRequestedRef.current) {
        setMode("simple");
      } else if (
        savedMode === "simple" ||
        savedMode === "guided" ||
        savedMode === "detailed"
      ) {
        setMode(savedMode);
      }

      setTemplates((templatesResult.data ?? []) as TransactionTemplate[]);
      setPostedTemplateIds(
        new Set(
          ((postingsResult.data ?? []) as PostingRow[]).map(
            (posting) => posting.template_id,
          ),
        ),
      );
      setLoading(false);
    }

    void loadEffortlessEntry();
    return () => {
      mounted = false;
    };
  }, [periodKey, supabase]);

  useEffect(() => {
    function handleCreated(event: Event) {
      const created = (event as CustomEvent<TransactionForPreset>).detail;
      if (!created?.id) return;
      setTransactions((current) => [
        created,
        ...current.filter((transaction) => transaction.id !== created.id),
      ]);
    }

    window.addEventListener("ficonter:transaction-created", handleCreated);
    return () =>
      window.removeEventListener("ficonter:transaction-created", handleCreated);
  }, []);


  useEffect(() => {
    function handleQuickAdd() {
      activateQuickAdd();
    }

    window.addEventListener(
      "ficonter:quick-add-transaction",
      handleQuickAdd,
    );

    if (window.location.hash === "#quick-add") {
      activateQuickAdd();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }

    return () =>
      window.removeEventListener(
        "ficonter:quick-add-transaction",
        handleQuickAdd,
      );
  }, [activateQuickAdd]);

  const favorites = useMemo(
    () => templates.filter((template) => template.is_favorite).slice(0, 6),
    [templates],
  );
  const recentPresets = useMemo(
    () => createRecentPresets(transactions, 5),
    [transactions],
  );
  const dueTemplates = useMemo(
    () =>
      templates.filter((template) =>
        isTemplateDueThisMonth(template, postedTemplateIds),
      ),
    [postedTemplateIds, templates],
  );
  const eurDueTemplates = useMemo(
    () => dueTemplates.filter((template) => template.currency === "EUR"),
    [dueTemplates],
  );

  async function changeMode(nextMode: EntryMode) {
    if (nextMode === mode || savingMode) return;
    const previousMode = mode;
    setMode(nextMode);
    setSavingMode(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Please log in again.");

      const { error: preferenceError } = await supabase
        .from("money_entry_preferences")
        .upsert(
          { user_id: user.id, entry_mode: nextMode },
          { onConflict: "user_id" },
        );
      if (preferenceError) throw preferenceError;
      setNotice(`${ENTRY_MODE_OPTIONS.find((option) => option.value === nextMode)?.label} entry is now active.`);
      window.setTimeout(() => setNotice(""), 2600);
    } catch (modeError) {
      setMode(previousMode);
      setError(
        modeError instanceof Error
          ? modeError.message
          : "The entry preference could not be saved.",
      );
    } finally {
      setSavingMode(false);
    }
  }

  function loadPreset(preset: TransactionPreset) {
    setActivePreset({ ...preset, key: `${preset.key}:${Date.now()}` });
    setNotice(`${preset.label} is ready to review.`);
    window.setTimeout(() => setNotice(""), 2200);
  }

  async function deleteTemplate(templateId: string) {
    setError("");
    const { error: deleteError } = await supabase
      .from("transaction_templates")
      .delete()
      .eq("id", templateId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setTemplates((current) =>
      current.filter((template) => template.id !== templateId),
    );
    setPostedTemplateIds((current) => {
      const next = new Set(current);
      next.delete(templateId);
      return next;
    });
    setNotice("Shortcut removed. Existing transactions were not changed.");
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function postRecurringTemplate(template: TransactionTemplate) {
    if (template.currency !== "EUR") {
      loadPreset(templateToPreset(template, periodKey));
      setNotice("Review the current exchange rate, then save this recurring entry.");
      return;
    }

    setPostingId(template.id);
    setError("");

    try {
      const { data, error: postingError } = await supabase.rpc(
        "post_monthly_transaction_template",
        {
          p_template_id: template.id,
          p_period_key: periodKey,
        },
      );
      if (postingError) throw postingError;

      const saved = normalizeSavedTransaction(data);
      if (!saved?.id) throw new Error("The recurring transaction was not returned.");

      setPostedTemplateIds((current) => new Set(current).add(template.id));
      window.dispatchEvent(
        new CustomEvent("ficonter:transaction-created", { detail: saved }),
      );
      notifyFiconterDataChange("all");
      setNotice(`${template.label} was added for this month.`);
      window.setTimeout(() => setNotice(""), 2600);
    } catch (postingError) {
      setError(
        postingError instanceof Error
          ? postingError.message
          : "The recurring entry could not be added.",
      );
    } finally {
      setPostingId(null);
    }
  }

  async function confirmAllEuroEntries() {
    if (eurDueTemplates.length === 0 || bulkPosting) return;
    setBulkPosting(true);
    setError("");
    let completed = 0;

    try {
      for (const template of eurDueTemplates) {
        const { data, error: postingError } = await supabase.rpc(
          "post_monthly_transaction_template",
          {
            p_template_id: template.id,
            p_period_key: periodKey,
          },
        );
        if (postingError) throw postingError;
        const saved = normalizeSavedTransaction(data);
        if (saved?.id) {
          completed += 1;
          window.dispatchEvent(
            new CustomEvent("ficonter:transaction-created", { detail: saved }),
          );
          setPostedTemplateIds((current) => new Set(current).add(template.id));
        }
      }

      notifyFiconterDataChange("all");
      setNotice(
        completed === 1
          ? "1 recurring entry was confirmed."
          : `${completed} recurring entries were confirmed.`,
      );
      window.setTimeout(() => setNotice(""), 2800);
    } catch (bulkError) {
      setError(
        bulkError instanceof Error
          ? bulkError.message
          : "The recurring entries could not all be confirmed.",
      );
    } finally {
      setBulkPosting(false);
    }
  }

  return (
    <div className={styles.workspace}>
      <section className={styles.modeCard} aria-labelledby="entry-style-title">
        <div className={styles.sectionHeading}>
          <span className={styles.iconBadge}>
            <Settings2 size={18} />
          </span>
          <div>
            <h4 id="entry-style-title">Choose your mode</h4>
            <p>Pick the easiest way to add a transaction.</p>
          </div>
        </div>
        <div className={styles.modeGrid}>
          {ENTRY_MODE_OPTIONS.map((option) => {
            const presentation = ENTRY_MODE_PRESENTATION[option.value];
            const ModeIcon = presentation.icon;

            return (
              <button
                key={option.value}
                type="button"
                className={mode === option.value ? styles.modeActive : styles.modeButton}
                onClick={() => void changeMode(option.value)}
                aria-pressed={mode === option.value}
                disabled={savingMode}
              >
                <span className={styles.modeIcon} aria-hidden="true">
                  <ModeIcon size={20} />
                </span>
                <span className={styles.modeCopy}>
                  <strong>{option.label}</strong>
                  <span>{presentation.description}</span>
                </span>
                <small className={styles.modeBadge}>{presentation.badge}</small>
                <ChevronRight className={styles.modeChevron} size={20} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      {dueTemplates.length > 0 && (
        <section className={styles.recurringCard} aria-labelledby="recurring-title">
          <div className={styles.sectionHeadingRow}>
            <div className={styles.sectionHeading}>
              <span className={styles.iconBadge}>
                <Repeat2 size={17} />
              </span>
              <div>
                <h4 id="recurring-title">Ready for this month</h4>
                <p>Confirm normal recurring entries instead of typing them again.</p>
              </div>
            </div>
            {eurDueTemplates.length > 1 && (
              <button
                type="button"
                className={styles.confirmAllButton}
                onClick={() => void confirmAllEuroEntries()}
                disabled={bulkPosting}
              >
                {bulkPosting ? <Loader2 size={15} className={styles.spin} /> : <Zap size={15} />}
                Confirm all EUR
              </button>
            )}
          </div>

          <div className={styles.recurringList}>
            {dueTemplates.map((template) => (
              <div className={styles.recurringRow} key={template.id}>
                <div>
                  <strong>{template.label}</strong>
                  <span>
                    Day {template.day_of_month} · {template.category}
                  </span>
                </div>
                <strong>{formatCurrency(Number(template.amount), template.currency)}</strong>
                <button
                  type="button"
                  onClick={() => void postRecurringTemplate(template)}
                  disabled={postingId === template.id || bulkPosting}
                >
                  {postingId === template.id ? (
                    <Loader2 size={15} className={styles.spin} />
                  ) : template.currency === "EUR" ? (
                    "Confirm"
                  ) : (
                    "Review rate"
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {(favorites.length > 0 || recentPresets.length > 0) && (
        <section className={styles.shortcutsCard} aria-labelledby="shortcuts-title">
          <div className={styles.sectionHeading}>
            <span className={styles.iconBadge}>
              <Sparkles size={17} />
            </span>
            <div>
              <h4 id="shortcuts-title">Reuse instead of retyping</h4>
              <p>Load a familiar entry, check it, and save.</p>
            </div>
          </div>

          {favorites.length > 0 && (
            <div className={styles.shortcutSection}>
              <div className={styles.shortcutLabel}>
                <Star size={14} /> Favourites
              </div>
              <div className={styles.chipGrid}>
                {favorites.map((template) => (
                  <div className={styles.templateChip} key={template.id}>
                    <button
                      type="button"
                      onClick={() => loadPreset(templateToPreset(template))}
                    >
                      <strong>{template.label}</strong>
                      <span>
                        {formatCurrency(Number(template.amount), template.currency)} · {template.category}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${template.label} shortcut`}
                      title="Remove shortcut"
                      onClick={() => void deleteTemplate(template.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentPresets.length > 0 && (
            <div className={styles.shortcutSection}>
              <div className={styles.shortcutLabel}>
                <Clock3 size={14} /> Recent
              </div>
              <div className={styles.recentGrid}>
                {recentPresets.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className={styles.recentButton}
                    onClick={() => loadPreset(preset)}
                  >
                    <strong>{preset.label}</strong>
                    <span>
                      {formatCurrency(preset.amount, preset.currency)} · {preset.category}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
      {loading && (
        <div className={styles.loadingState}>
          <Loader2 size={17} className={styles.spin} /> Preparing your shortcuts…
        </div>
      )}

      <section
        ref={formSectionRef}
        id="ficonter-quick-add"
        className={styles.formSection}
        aria-labelledby="add-transaction-title"
      >
        <div className={styles.formHeading}>
          <div>
            <h3 id="add-transaction-title">Add transaction</h3>
            <p>
              {mode === "simple"
                ? "A compact quick-add screen with only the essentials."
                : mode === "guided"
                  ? "A calm three-step journey with explanations and review."
                  : "A complete ledger form with every field visible."}
            </p>
          </div>
          <span>{ENTRY_MODE_OPTIONS.find((option) => option.value === mode)?.label}</span>
        </div>
        <TransactionForm
          key={`${mode}:${activePreset?.key ?? `blank:${initialType}`}`}
          initialType={initialType}
          entryMode={mode}
          preset={activePreset}
          allowMultiCurrency={allowMultiCurrency}
          onTemplateSaved={(template) =>
            setTemplates((current) => [
              template,
              ...current.filter((item) => item.id !== template.id),
            ])
          }
          onSaved={() => {
            if (activePreset?.templateId && activePreset.periodKey) {
              setPostedTemplateIds((current) =>
                new Set(current).add(activePreset.templateId as string),
              );
            }
            setActivePreset(null);
          }}
        />
      </section>
    </div>
  );
}
