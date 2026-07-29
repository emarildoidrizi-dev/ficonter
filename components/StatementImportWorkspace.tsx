"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import {
  CATEGORY_ITEMS,
  CURRENCY_CODES,
  currencySymbol,
  formatCurrency,
} from "@/lib/financialOptions";
import {
  autoMapHeaders,
  deriveMerchantKey,
  delimiterLabel,
  detectDelimiter,
  parseDelimitedText,
  prepareStatementRows,
  transactionSignature,
  type ExistingTransactionForImport,
  type PreparedStatementRow,
  type StatementDateFormat,
  type StatementMapping,
  type StatementNumberFormat,
  type StatementRule,
} from "@/lib/statementImport";
import styles from "./StatementImportWorkspace.module.css";

type Props = {
  existingTransactions: ExistingTransactionForImport[];
};

type ImportProfile = {
  id: string;
  name: string;
  delimiter: string;
  mapping: StatementMapping;
};

type ImportResult = {
  batchId: string;
  requestedCount: number;
  importedCount: number;
  skippedDuplicateCount: number;
  skippedInvalidCount: number;
};

type ReviewFilter = "all" | "ready" | "duplicate" | "invalid";
type SourceKind = "delimited" | "pdf";
type PdfMeta = {
  pageCount: number;
  transactionCount: number;
  assumedDirectionCount: number;
  extractedLineCount: number;
};

const MAX_DELIMITED_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 2000;
const PAGE_SIZE = 25;

function columnValue(index: number | null) {
  return index === null ? "" : String(index);
}

function readColumnValue(value: string) {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function currencyLabel(code: string) {
  return `${currencySymbol(code)} ${code}`;
}

function localNoonIso(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

function defaultMapping(): StatementMapping {
  return {
    dateColumn: null,
    descriptionColumn: null,
    extraDescriptionColumn: null,
    amountColumn: null,
    debitColumn: null,
    creditColumn: null,
    currencyColumn: null,
    dateFormat: "auto",
    numberFormat: "auto",
    defaultCurrency: "EUR",
  };
}

export function StatementImportWorkspace({ existingTransactions }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState("");
  const [rawText, setRawText] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [sourceKind, setSourceKind] = useState<SourceKind>("delimited");
  const [pdfMeta, setPdfMeta] = useState<PdfMeta | null>(null);
  const [delimiter, setDelimiter] = useState(",");
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<StatementMapping>(defaultMapping());
  const [preparedRows, setPreparedRows] = useState<PreparedStatementRow[]>([]);
  const [profiles, setProfiles] = useState<ImportProfile[]>([]);
  const [rules, setRules] = useState<StatementRule[]>([]);
  const [selectedProfile, setSelectedProfile] = useState("");
  const [rememberMapping, setRememberMapping] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [page, setPage] = useState(1);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [postImportWarning, setPostImportWarning] = useState("");

  const headers = useMemo(() => {
    if (!parsedRows.length) return [];
    if (hasHeader) return parsedRows[0];
    const width = Math.max(...parsedRows.map((row) => row.length));
    return Array.from({ length: width }, (_, index) => `Column ${index + 1}`);
  }, [hasHeader, parsedRows]);

  const dataRows = useMemo(
    () => (hasHeader ? parsedRows.slice(1) : parsedRows),
    [hasHeader, parsedRows],
  );

  useEffect(() => {
    if (!open) return;
    let mounted = true;

    async function loadSettings() {
      setLoadingSettings(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted || !user) {
        setLoadingSettings(false);
        return;
      }

      const [profilesResult, rulesResult] = await Promise.all([
        supabase
          .from("statement_import_profiles")
          .select("id,name,delimiter,mapping")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("transaction_category_rules")
          .select("id,match_text,category,transaction_type,priority")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("priority", { ascending: false }),
      ]);

      if (!mounted) return;
      const firstError = profilesResult.error || rulesResult.error;
      if (firstError) {
        setError(
          firstError.message.includes("does not exist") || firstError.message.includes("schema cache")
            ? "Financial File Import needs its Supabase setup before saved formats and rules can be used."
            : firstError.message,
        );
      }

      setProfiles((profilesResult.data ?? []) as ImportProfile[]);
      const savedRules = (rulesResult.data ?? []) as Array<{
        id: string;
        match_text: string;
        category: string;
        transaction_type: "any" | "income" | "expense" | "saving";
        priority: number;
      }>;
      setRules(
        savedRules.map((rule) => ({
          id: rule.id,
          match_text: rule.match_text,
          category: rule.category,
          transaction_type:
            rule.transaction_type === "any" ? null : rule.transaction_type,
          priority: rule.priority,
        })),
      );
      setLoadingSettings(false);
    }

    void loadSettings();
    return () => {
      mounted = false;
    };
  }, [open, supabase]);

  function resetImport(keepOpen = true) {
    setStep(1);
    setFileName("");
    setRawText("");
    setFileSize(0);
    setSourceKind("delimited");
    setPdfMeta(null);
    setDelimiter(",");
    setParsedRows([]);
    setHasHeader(true);
    setMapping(defaultMapping());
    setPreparedRows([]);
    setSelectedProfile("");
    setProfileName("");
    setReviewFilter("all");
    setPage(1);
    setResult(null);
    setPostImportWarning("");
    setError("");
    setNotice("");
    setOpen(keepOpen);
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setNotice("");
    setReadingFile(true);
    const extension = file.name.split(".").pop()?.toLowerCase();

    try {
      if (extension === "pdf") {
        if (file.size > MAX_PDF_FILE_BYTES) {
          throw new Error("Choose a PDF smaller than 10 MB.");
        }

        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/financial-file/pdf-extract", {
          method: "POST",
          body,
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as {
          rows?: string[][];
          pageCount?: number;
          transactionCount?: number;
          assumedDirectionCount?: number;
          extractedLineCount?: number;
          error?: string;
        } | null;
        if (!response.ok || !payload?.rows?.length) {
          throw new Error(payload?.error || "The PDF could not be analysed.");
        }

        const rows = payload.rows;
        const nextHeaders = rows[0] ?? [];
        setFileName(file.name);
        setRawText("");
        setFileSize(file.size);
        setSourceKind("pdf");
        setPdfMeta({
          pageCount: Number(payload.pageCount ?? 0),
          transactionCount: Number(payload.transactionCount ?? Math.max(0, rows.length - 1)),
          assumedDirectionCount: Number(payload.assumedDirectionCount ?? 0),
          extractedLineCount: Number(payload.extractedLineCount ?? 0),
        });
        setDelimiter(",");
        setParsedRows(rows);
        setHasHeader(true);
        setMapping(autoMapHeaders(nextHeaders, "EUR"));
        setRememberMapping(false);
        setProfileName("");
        setStep(2);
        const assumed = Number(payload.assumedDirectionCount ?? 0);
        setNotice(
          `${Math.max(0, rows.length - 1)} possible transactions were extracted from ${Number(payload.pageCount ?? 0)} PDF page${Number(payload.pageCount ?? 0) === 1 ? "" : "s"}.${assumed ? ` Review ${assumed} transaction type${assumed === 1 ? "" : "s"} that required a direction assumption.` : ""}`,
        );
        return;
      }

      if (!extension || !["csv", "txt", "tsv"].includes(extension)) {
        throw new Error("Choose a PDF, CSV, TSV or text financial file.");
      }
      if (file.size > MAX_DELIMITED_FILE_BYTES) {
        throw new Error("Choose a CSV or text file smaller than 5 MB.");
      }

      const text = await file.text();
      const detected = extension === "tsv" ? "\t" : detectDelimiter(text);
      const rows = parseDelimitedText(text, detected);
      if (rows.length < 2) throw new Error("The file does not contain enough transaction rows.");
      if (rows.length - 1 > MAX_ROWS) {
        throw new Error("Import a maximum of 2,000 transaction rows at a time.");
      }

      const headerProbe = autoMapHeaders(rows[0], "EUR");
      const firstRowLooksLikeHeader =
        headerProbe.dateColumn !== null &&
        headerProbe.descriptionColumn !== null &&
        (headerProbe.amountColumn !== null ||
          headerProbe.debitColumn !== null ||
          headerProbe.creditColumn !== null);
      const nextHasHeader = firstRowLooksLikeHeader;
      const nextHeaders = nextHasHeader
        ? rows[0]
        : Array.from(
            { length: Math.max(...rows.map((row) => row.length)) },
            (_, index) => `Column ${index + 1}`,
          );

      setFileName(file.name);
      setRawText(text);
      setFileSize(file.size);
      setSourceKind("delimited");
      setPdfMeta(null);
      setDelimiter(detected);
      setParsedRows(rows);
      setHasHeader(nextHasHeader);
      setMapping(autoMapHeaders(nextHeaders, "EUR"));
      setRememberMapping(true);
      setProfileName(file.name.replace(/\.[^.]+$/, "").slice(0, 80));
      setStep(2);
      setNotice(`${rows.length - (nextHasHeader ? 1 : 0)} transaction rows detected.`);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "The financial file could not be read.");
    } finally {
      setReadingFile(false);
    }
  }

  function toggleHeader(next: boolean) {
    setHasHeader(next);
    if (!parsedRows.length) return;
    const nextHeaders = next
      ? parsedRows[0]
      : Array.from(
          { length: Math.max(...parsedRows.map((row) => row.length)) },
          (_, index) => `Column ${index + 1}`,
        );
    setMapping((current) => autoMapHeaders(nextHeaders, current.defaultCurrency));
  }

  function applyProfile(profileId: string) {
    setSelectedProfile(profileId);
    if (!profileId || sourceKind === "pdf") return;
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) return;
    setDelimiter(profile.delimiter);
    if (rawText) setParsedRows(parseDelimitedText(rawText, profile.delimiter));
    setMapping(profile.mapping);
    setProfileName(profile.name);
    setNotice(`${profile.name} format applied. Review the field matches before continuing.`);
  }


  function changeDelimiter(nextDelimiter: string) {
    setDelimiter(nextDelimiter);
    if (!rawText) return;
    const rows = parseDelimitedText(rawText, nextDelimiter);
    setParsedRows(rows);
    const nextHeaders = hasHeader
      ? rows[0] ?? []
      : Array.from(
          { length: Math.max(1, ...rows.map((row) => row.length)) },
          (_, index) => `Column ${index + 1}`,
        );
    setMapping((current) => autoMapHeaders(nextHeaders, current.defaultCurrency));
  }

  function updateMapping<Key extends keyof StatementMapping>(
    key: Key,
    value: StatementMapping[Key],
  ) {
    setMapping((current) => ({ ...current, [key]: value }));
  }

  async function preparePreview() {
    setError("");
    setNotice("");
    if (mapping.dateColumn === null) {
      setError("Choose the transaction-date column.");
      return;
    }
    if (mapping.descriptionColumn === null) {
      setError("Choose the description or merchant column.");
      return;
    }
    if (
      mapping.amountColumn === null &&
      mapping.debitColumn === null &&
      mapping.creditColumn === null
    ) {
      setError("Choose one signed Amount field, or choose Debit and Credit fields.");
      return;
    }
    if (
      mapping.amountColumn === null &&
      (mapping.debitColumn === null || mapping.creditColumn === null)
    ) {
      setError("When no signed Amount field is used, choose both Debit and Credit fields.");
      return;
    }

    setPreparing(true);
    try {
      let nextRows = prepareStatementRows({
        rows: dataRows,
        mapping,
        rules,
        existingTransactions,
        sourceRowOffset: hasHeader ? 2 : 1,
      });

      const currencies = [...new Set(nextRows.filter((row) => !row.parseError).map((row) => row.currency))];
      const rateMap = new Map<string, { rate: number; date: string; source: string }>();
      rateMap.set("EUR", {
        rate: 1,
        date: new Date().toISOString().slice(0, 10),
        source: "identity",
      });

      await Promise.all(
        currencies
          .filter((currency) => currency !== "EUR")
          .map(async (currency) => {
            const response = await fetch(
              `/api/exchange-rate?from=${encodeURIComponent(currency)}&to=EUR`,
              { cache: "no-store" },
            );
            const payload = (await response.json()) as {
              rate?: number;
              date?: string;
              source?: string;
              error?: string;
            };
            if (!response.ok || !payload.rate || !payload.date || !payload.source) {
              throw new Error(payload.error || `No EUR exchange rate is available for ${currency}.`);
            }
            rateMap.set(currency, {
              rate: Number(payload.rate),
              date: payload.date,
              source: `${payload.source} financial file import`,
            });
          }),
      );

      nextRows = nextRows.map((row) => {
        const rate = rateMap.get(row.currency);
        if (!rate && !row.parseError) {
          return {
            ...row,
            included: false,
            parseError: `No EUR exchange rate is available for ${row.currency}.`,
          };
        }
        return rate ? { ...row, ...rate } : row;
      });

      setPreparedRows(nextRows);
      setReviewFilter("all");
      setPage(1);
      setStep(3);
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "The financial-file preview could not be prepared.",
      );
    } finally {
      setPreparing(false);
    }
  }

  function updatePreparedRow(index: number, patch: Partial<PreparedStatementRow>) {
    setPreparedRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  const reviewRows = useMemo(() => {
    return preparedRows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => {
        if (reviewFilter === "ready") return !row.parseError && !row.possibleDuplicate;
        if (reviewFilter === "duplicate") return row.possibleDuplicate;
        if (reviewFilter === "invalid") return Boolean(row.parseError);
        return true;
      });
  }, [preparedRows, reviewFilter]);

  const pageCount = Math.max(1, Math.ceil(reviewRows.length / PAGE_SIZE));
  const visibleRows = reviewRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const counts = useMemo(() => {
    let ready = 0;
    let duplicates = 0;
    let invalid = 0;
    let selected = 0;
    preparedRows.forEach((row) => {
      if (row.parseError) invalid += 1;
      else if (row.possibleDuplicate) duplicates += 1;
      else ready += 1;
      if (row.included && !row.parseError) selected += 1;
    });
    return { ready, duplicates, invalid, selected };
  }, [preparedRows]);

  async function saveProfileAndRules(userId: string, importedRows: PreparedStatementRow[]) {
    if (sourceKind === "delimited" && rememberMapping && profileName.trim()) {
      const { error: profileError } = await supabase
        .from("statement_import_profiles")
        .upsert(
          {
            user_id: userId,
            name: profileName.trim().slice(0, 80),
            delimiter,
            mapping,
          },
          { onConflict: "user_id,name" },
        );
      if (profileError) throw profileError;
    }

    const rulesToSave = importedRows
      .filter((row) => row.rememberRule && row.merchantKey.length >= 2)
      .map((row) => ({
        user_id: userId,
        match_text: row.merchantKey,
        category: row.category,
        transaction_type: row.type,
        priority: 10,
        is_active: true,
      }));

    if (rulesToSave.length) {
      const uniqueRules = [...new Map(
        rulesToSave.map((rule) => [`${rule.match_text}|${rule.transaction_type}`, rule]),
      ).values()];
      const { error: rulesError } = await supabase
        .from("transaction_category_rules")
        .upsert(uniqueRules, { onConflict: "user_id,match_text,transaction_type" });
      if (rulesError) throw rulesError;
    }
  }

  async function importStatement() {
    const rowsToImport = preparedRows.filter((row) => row.included && !row.parseError);
    if (!rowsToImport.length) {
      setError("Select at least one valid transaction row to import.");
      return;
    }

    setImporting(true);
    setError("");
    setNotice("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Please log in again.");

      const rpcRows = rowsToImport.map((row) => ({
        description: row.description,
        amount: Number(row.amount.toFixed(2)),
        currency: row.currency,
        amountEur: Number((row.amount * row.rate).toFixed(6)),
        exchangeRateToEur: row.rate,
        exchangeRateDate: row.rateDate,
        exchangeRateSource: row.rateSource,
        type: row.type,
        category: row.category,
        transactionDate: row.date,
        occurredAt: localNoonIso(row.date),
        sourceRowNumber: row.sourceRowNumber,
        fingerprintSeed: `${transactionSignature({
          date: row.date,
          description: row.description,
          amount: row.amount,
          currency: row.currency,
          type: row.type,
        })}|${row.occurrence}`,
        forceImport: row.possibleDuplicate,
      }));

      const { data, error: importError } = await supabase.rpc(
        "import_statement_transactions",
        {
          p_file_name: fileName,
          p_rows: rpcRows,
          p_mapping: {
            sourceKind,
            delimiter: sourceKind === "delimited" ? delimiter : null,
            hasHeader,
            mapping,
            pdfMeta: sourceKind === "pdf" ? pdfMeta : null,
          },
        },
      );
      if (importError) throw importError;

      const completedResult = data as ImportResult;
      try {
        await saveProfileAndRules(user.id, rowsToImport);
      } catch {
        setPostImportWarning(
          "The transactions were imported, but the saved file format or category rules could not be stored.",
        );
      }
      setResult(completedResult);
      setStep(4);
      notifyFiconterDataChange("transactions");
    } catch (importFailure) {
      setError(
        importFailure instanceof Error
          ? importFailure.message
          : "The financial file could not be imported.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className={styles.shell} aria-label="Financial file import">
      {!open ? (
        <div className={styles.closedCard}>
          <div className={styles.closedIcon}><FileSpreadsheet size={22} /></div>
          <div className={styles.closedCopy}>
            <strong>Import financial records</strong>
            <span>Upload a bank or card statement, transaction export, or another supported financial file.</span>
          </div>
          <button className="button secondary" type="button" onClick={() => setOpen(true)}>
            <Upload size={16} /> Import file
          </button>
        </div>
      ) : (
        <div className={styles.workspace}>
          <div className={styles.workspaceHead}>
            <div>
              <span className={styles.eyebrow}>Effortless Entry</span>
              <h2>Financial File Import</h2>
              <p>Nothing is saved until you review and confirm it.</p>
            </div>
            <button className={styles.iconButton} type="button" onClick={() => resetImport(false)} aria-label="Close financial file import">
              <X size={18} />
            </button>
          </div>

          <div className={styles.steps} aria-label="Import progress">
            {["Upload file", "Match fields", "Review", "Complete"].map((label, index) => {
              const number = index + 1;
              const active = step === number;
              const complete = step > number;
              return (
                <div className={`${styles.step} ${active ? styles.stepActive : ""} ${complete ? styles.stepComplete : ""}`} key={label}>
                  <span>{complete ? <Check size={13} /> : number}</span>
                  <small>{label}</small>
                </div>
              );
            })}
          </div>

          {error ? <div className="alert alert-error">{error}</div> : null}
          {notice ? <div className="alert alert-success">{notice}</div> : null}

          {step === 1 ? (
            <div className={styles.uploadStage}>
              <label className={`${styles.dropZone} ${readingFile ? styles.dropZoneBusy : ""}`}>
                {readingFile ? <Loader2 className={styles.spin} size={28} /> : <Upload size={28} />}
                <strong>{readingFile ? "Reading your financial file…" : "Choose a financial file"}</strong>
                <span>PDF up to 10 MB · CSV, TSV or TXT up to 5 MB · maximum 2,000 transactions</span>
                <input
                  type="file"
                  accept=".pdf,.csv,.tsv,.txt,application/pdf,text/csv,text/plain,text/tab-separated-values"
                  onChange={chooseFile}
                  disabled={readingFile}
                />
              </label>
              <div className={styles.formatGrid}>
                <div className={styles.formatCard}>
                  <FileSpreadsheet size={19} />
                  <div><strong>Structured exports</strong><span>CSV, TSV and TXT transaction files</span></div>
                </div>
                <div className={styles.formatCard}>
                  <FileText size={19} />
                  <div><strong>Searchable PDFs</strong><span>Bank, card and payment transaction reports</span></div>
                </div>
              </div>
              <div className={styles.privacyNote}>
                <CheckCircle2 size={17} />
                <span>FICONTER reads the file only to prepare your preview. It does not require a banking password or bank connection.</span>
              </div>
              <div className={styles.pdfNote}>
                <AlertTriangle size={16} />
                <span>PDF layouts differ. Review extracted transaction types and categories before importing. Scanned image-only and password-protected PDFs are not supported yet.</span>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className={styles.mappingStage}>
              <div className={styles.fileSummary}>
                <FileSpreadsheet size={20} />
                <div>
                  <strong>{fileName}</strong>
                  <span>
                    {Math.max(1, Math.round(fileSize / 1024))} KB · {dataRows.length} possible transaction{dataRows.length === 1 ? "" : "s"} · {sourceKind === "pdf" ? `${pdfMeta?.pageCount ?? 0} PDF page${pdfMeta?.pageCount === 1 ? "" : "s"}` : `${delimiterLabel(delimiter)} separated`}
                  </span>
                </div>
                <button type="button" className={styles.textButton} onClick={() => resetImport(true)}>Choose another file</button>
              </div>

              {sourceKind === "delimited" && profiles.length ? (
                <label className={styles.fullField}>
                  <span>Saved file format</span>
                  <select value={selectedProfile} onChange={(event: ChangeEvent<HTMLSelectElement>) => applyProfile(event.target.value)} disabled={loadingSettings}>
                    <option value="">Use automatic column matching</option>
                    {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                  </select>
                </label>
              ) : null}

              {sourceKind === "delimited" ? (
                <label className={styles.checkboxLine}>
                  <input type="checkbox" checked={hasHeader} onChange={(event: ChangeEvent<HTMLInputElement>) => toggleHeader(event.target.checked)} />
                  <span>The first row contains column headings</span>
                </label>
              ) : (
                <div className={styles.pdfExtractionNotice}>
                  <FileText size={17} />
                  <span>FICONTER extracted possible transaction rows from this PDF. Confirm the field matches below before continuing.</span>
                </div>
              )}

              <div className={styles.mappingGrid}>
                <ColumnSelect label="Transaction date" value={mapping.dateColumn} headers={headers} required onChange={(value) => updateMapping("dateColumn", value)} />
                <ColumnSelect label="Description / merchant" value={mapping.descriptionColumn} headers={headers} required onChange={(value) => updateMapping("descriptionColumn", value)} />
                <ColumnSelect label="Extra description" value={mapping.extraDescriptionColumn} headers={headers} onChange={(value) => updateMapping("extraDescriptionColumn", value)} />
                <ColumnSelect label="Signed amount" value={mapping.amountColumn} headers={headers} onChange={(value) => updateMapping("amountColumn", value)} help="Use this when income is positive and spending is negative." />
                <ColumnSelect label="Debit / money out" value={mapping.debitColumn} headers={headers} onChange={(value) => updateMapping("debitColumn", value)} />
                <ColumnSelect label="Credit / money in" value={mapping.creditColumn} headers={headers} onChange={(value) => updateMapping("creditColumn", value)} />
                <ColumnSelect label="Currency" value={mapping.currencyColumn} headers={headers} onChange={(value) => updateMapping("currencyColumn", value)} help="Optional when the whole file uses one currency." />

                {sourceKind === "delimited" ? (
                  <label className={styles.field}>
                    <span>Column separator</span>
                    <select value={delimiter} onChange={(event: ChangeEvent<HTMLSelectElement>) => changeDelimiter(event.target.value)}>
                      <option value=",">Comma</option>
                      <option value=";">Semicolon</option>
                      <option value="\t">Tab</option>
                      <option value="|">Pipe</option>
                    </select>
                  </label>
                ) : null}
                <label className={styles.field}>
                  <span>Default currency</span>
                  <select value={mapping.defaultCurrency} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateMapping("defaultCurrency", event.target.value)}>
                    {CURRENCY_CODES.map((code) => <option key={code} value={code}>{currencyLabel(code)}</option>)}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Date format</span>
                  <select value={mapping.dateFormat} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateMapping("dateFormat", event.target.value as StatementDateFormat)}>
                    <option value="auto">Detect automatically</option>
                    <option value="dd.mm.yyyy">DD.MM.YYYY</option>
                    <option value="dd/mm/yyyy">DD/MM/YYYY</option>
                    <option value="mm/dd/yyyy">MM/DD/YYYY</option>
                    <option value="yyyy-mm-dd">YYYY-MM-DD</option>
                    <option value="dd-mm-yyyy">DD-MM-YYYY</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Number format</span>
                  <select value={mapping.numberFormat} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateMapping("numberFormat", event.target.value as StatementNumberFormat)}>
                    <option value="auto">Detect automatically</option>
                    <option value="1.234,56">1.234,56</option>
                    <option value="1,234.56">1,234.56</option>
                  </select>
                </label>
              </div>

              <div className={styles.mappingPreview}>
                <strong>{sourceKind === "pdf" ? "First extracted record" : "First file row"}</strong>
                <div>{headers.map((header, index) => <span key={`${header}-${index}`}><small>{header}</small>{dataRows[0]?.[index] || "—"}</span>)}</div>
              </div>

              <div className={styles.footerActions}>
                <button className="button secondary" type="button" onClick={() => setStep(1)}><ArrowLeft size={16} /> Back</button>
                <button className="button" type="button" onClick={preparePreview} disabled={preparing}>
                  {preparing ? <Loader2 className={styles.spin} size={16} /> : <ArrowRight size={16} />}
                  Prepare preview
                </button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className={styles.reviewStage}>
              <div className={styles.summaryCards}>
                <SummaryCard label="Ready" value={counts.ready} tone="good" />
                <SummaryCard label="Possible duplicates" value={counts.duplicates} tone="warning" />
                <SummaryCard label="Needs review" value={counts.invalid} tone="danger" />
                <SummaryCard label="Selected to import" value={counts.selected} tone="neutral" />
              </div>

              <div className={styles.reviewToolbar}>
                <div className={styles.filters}>
                  {(["all", "ready", "duplicate", "invalid"] as ReviewFilter[]).map((filter) => (
                    <button key={filter} type="button" className={reviewFilter === filter ? styles.filterActive : ""} onClick={() => { setReviewFilter(filter); setPage(1); }}>
                      {filter === "all" ? "All" : filter === "ready" ? "Ready" : filter === "duplicate" ? "Duplicates" : "Needs review"}
                    </button>
                  ))}
                </div>
                <button type="button" className={styles.textButton} onClick={() => setPreparedRows((current) => current.map((row) => ({ ...row, included: !row.parseError && !row.possibleDuplicate })))}>
                  Reset selection
                </button>
              </div>

              <div className={styles.rateNote}>
                <AlertTriangle size={16} />
                <span>EUR rows remain unchanged. Non-EUR rows use one current EUR exchange rate per currency for this import.</span>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.reviewTable}>
                  <thead><tr><th>Use</th><th>Date</th><th>Description</th><th>Amount</th><th>Type</th><th>Category</th><th>Remember</th><th>Status</th></tr></thead>
                  <tbody>
                    {visibleRows.map(({ row, originalIndex }) => (
                      <tr key={`${row.sourceRowNumber}-${originalIndex}`} className={row.parseError ? styles.invalidRow : row.possibleDuplicate ? styles.duplicateRow : ""}>
                        <td><input type="checkbox" checked={row.included} disabled={Boolean(row.parseError)} onChange={(event: ChangeEvent<HTMLInputElement>) => updatePreparedRow(originalIndex, { included: event.target.checked })} aria-label={`Import row ${row.sourceRowNumber}`} /></td>
                        <td>{row.date || "—"}</td>
                        <td><input className={styles.cellInput} value={row.description} onChange={(event: ChangeEvent<HTMLInputElement>) => { const description = event.target.value.slice(0, 120); updatePreparedRow(originalIndex, { description, merchantKey: deriveMerchantKey(description) }); }} /></td>
                        <td className={styles.amountCell}>{formatCurrency(row.amount, row.currency)}</td>
                        <td>
                          <select value={row.type} onChange={(event: ChangeEvent<HTMLSelectElement>) => updatePreparedRow(originalIndex, { type: event.target.value as PreparedStatementRow["type"] })}>
                            <option value="expense">Expense</option><option value="income">Income</option><option value="saving">Saving</option>
                          </select>
                        </td>
                        <td><input className={styles.categoryInput} list="statement-import-categories" value={row.category} onChange={(event: ChangeEvent<HTMLInputElement>) => updatePreparedRow(originalIndex, { category: event.target.value })} /></td>
                        <td><label className={styles.rememberCell}><input type="checkbox" checked={row.rememberRule} disabled={Boolean(row.parseError)} onChange={(event: ChangeEvent<HTMLInputElement>) => updatePreparedRow(originalIndex, { rememberRule: event.target.checked })} /><span>Rule</span></label></td>
                        <td>
                          {row.parseError ? <span className={`${styles.status} ${styles.statusDanger}`}>{row.parseError}</span> : row.possibleDuplicate ? <span className={`${styles.status} ${styles.statusWarning}`}>Possible duplicate</span> : <span className={`${styles.status} ${styles.statusGood}`}>Ready</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <datalist id="statement-import-categories">{CATEGORY_ITEMS.map((category) => <option key={category} value={category} />)}</datalist>
              </div>

              {pageCount > 1 ? (
                <div className={styles.pagination}>
                  <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Previous</button>
                  <span>Page {page} of {pageCount}</span>
                  <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount}>Next</button>
                </div>
              ) : null}

              {sourceKind === "delimited" ? (
                <div className={styles.saveOptions}>
                  <label className={styles.checkboxLine}>
                    <input type="checkbox" checked={rememberMapping} onChange={(event: ChangeEvent<HTMLInputElement>) => setRememberMapping(event.target.checked)} />
                    <span>Remember this column format for future files</span>
                  </label>
                  {rememberMapping ? <label className={styles.profileField}><span>Format name</span><input value={profileName} onChange={(event: ChangeEvent<HTMLInputElement>) => setProfileName(event.target.value.slice(0, 80))} placeholder="Example: Sparkasse current account CSV" /></label> : null}
                </div>
              ) : null}

              <div className={styles.footerActions}>
                <button className="button secondary" type="button" onClick={() => setStep(2)}><ArrowLeft size={16} /> Change fields</button>
                <button className="button" type="button" onClick={importStatement} disabled={importing || counts.selected === 0}>
                  {importing ? <Loader2 className={styles.spin} size={16} /> : <Upload size={16} />}
                  Import {counts.selected} transaction{counts.selected === 1 ? "" : "s"}
                </button>
              </div>
            </div>
          ) : null}

          {step === 4 && result ? (
            <div className={styles.completeStage}>
              <div className={styles.completeIcon}><CheckCircle2 size={34} /></div>
              <h3>Financial file import complete</h3>
              <p>Your approved transactions are now part of the same FICONTER ledger used by Overview, Cash Flow, Planner and Financial GPS.</p>
              {postImportWarning ? <div className="alert alert-error">{postImportWarning}</div> : null}
              <div className={styles.resultGrid}>
                <div><strong>{result.importedCount}</strong><span>Imported</span></div>
                <div><strong>{result.skippedDuplicateCount}</strong><span>Duplicates skipped</span></div>
                <div><strong>{result.skippedInvalidCount}</strong><span>Invalid skipped</span></div>
              </div>
              <div className={styles.footerActionsCentered}>
                <button className="button secondary" type="button" onClick={() => resetImport(true)}><RotateCcw size={16} /> Import another file</button>
                <button className="button" type="button" onClick={() => resetImport(false)}>Return to transactions</button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ColumnSelect({
  label,
  value,
  headers,
  required,
  help,
  onChange,
}: {
  label: string;
  value: number | null;
  headers: string[];
  required?: boolean;
  help?: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className={styles.field}>
      <span>{label}{required ? " *" : ""}</span>
      <select value={columnValue(value)} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(readColumnValue(event.target.value))}>
        <option value="">Not used</option>
        {headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header || `Column ${index + 1}`}</option>)}
      </select>
      {help ? <small>{help}</small> : null}
    </label>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "good" | "warning" | "danger" | "neutral" }) {
  return <div className={`${styles.summaryCard} ${styles[`summary${tone[0].toUpperCase()}${tone.slice(1)}`]}`}><strong>{value}</strong><span>{label}</span></div>;
}
