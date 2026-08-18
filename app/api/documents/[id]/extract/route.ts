import { NextResponse } from "next/server";
import { extractText, extractTextItems, getDocumentProxy } from "unpdf";
import { DOCUMENT_BUCKET, isDocumentCategory } from "@/lib/documentVault";
import {
  extractFinancialDocumentDraft,
  type FinancialDocumentExtraction,
} from "@/lib/financialDocumentExtraction";
import { groupPdfTextItemsIntoLines, type PdfTextItem } from "@/lib/pdfFinancialImport";
import { noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { subscriptionApiAccessError } from "@/lib/subscriptionApiAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string }> };

type DocumentRow = {
  id: string;
  user_id: string;
  storage_path: string;
  original_name: string;
  display_name: string;
  category: string;
  mime_type: string;
  size_bytes: number;
  document_date: string | null;
};

type DisposablePdfDocument = {
  numPages?: number;
  destroy?: () => void | Promise<void>;
  cleanup?: () => void | Promise<void>;
};

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 80;
const EXTRACTION_TIMEOUT_MS = 20_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Document extraction timed out.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function disposePdf(document: unknown) {
  const disposable = document as DisposablePdfDocument | null;
  if (!disposable) return;
  if (typeof disposable.destroy === "function") {
    await disposable.destroy();
    return;
  }
  if (typeof disposable.cleanup === "function") await disposable.cleanup();
}

function positionedItemsToLines(
  pages: Array<Array<{ str: string; x: number; y: number; width: number }>>,
) {
  const lines: string[] = [];
  for (const pageItems of pages) {
    const compatibleItems: PdfTextItem[] = pageItems.map((item) => ({
      str: item.str,
      transform: [1, 0, 0, 1, item.x, item.y],
      width: item.width,
    }));
    lines.push(...groupPdfTextItemsIntoLines(compatibleItems));
  }
  return lines;
}

function extractionError(message: string, status = 422) {
  return NextResponse.json({ error: message }, { status, headers: noStoreHeaders() });
}

export async function GET(_request: Request, context: RouteContext) {
  const subscriptionAccessError = await subscriptionApiAccessError("financial_documents");
  if (subscriptionAccessError) return subscriptionAccessError;

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return extractionError("Sign in again before extracting financial data.", 401);

    const { id } = await context.params;
    const service = createServiceClient();
    const { data, error } = await service
      .from("financial_documents")
      .select("id,user_id,storage_path,original_name,display_name,category,mime_type,size_bytes,document_date")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) return extractionError("The document was not found.", 404);
    const document = data as DocumentRow;

    if (!isDocumentCategory(document.category)) {
      return extractionError("This document category is not supported by the extraction engine.");
    }
    if (document.mime_type !== "application/pdf") {
      return extractionError(
        "V1 can extract searchable PDFs. Image-only documents stay private in the vault but need OCR support before FICONTER can read them.",
      );
    }
    if (Number(document.size_bytes) <= 0 || Number(document.size_bytes) > MAX_PDF_BYTES) {
      return extractionError("Choose a PDF smaller than 10 MB.", 413);
    }

    const { data: file, error: downloadError } = await service.storage
      .from(DOCUMENT_BUCKET)
      .download(document.storage_path);
    if (downloadError || !file) return extractionError("The private document could not be opened.", 500);

    const bytes = new Uint8Array(await file.arrayBuffer());
    pdf = await withTimeout(
      getDocumentProxy(bytes, {
        maxImageSize: 16_777_216,
        disableAutoFetch: true,
        disableStream: true,
      }),
      EXTRACTION_TIMEOUT_MS,
    );

    if (pdf.numPages > MAX_PAGES) {
      return extractionError(`Import a PDF with no more than ${MAX_PAGES} pages at a time.`, 413);
    }

    const positioned = await withTimeout(extractTextItems(pdf), EXTRACTION_TIMEOUT_MS);
    let lines = positionedItemsToLines(positioned.items);
    if (!lines.length) {
      const plain = await withTimeout(extractText(pdf, { mergePages: false }), EXTRACTION_TIMEOUT_MS);
      const pages = Array.isArray(plain.text) ? plain.text : [plain.text];
      lines = pages.flatMap((page) => String(page).split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    }

    if (!lines.length) {
      return extractionError(
        "No readable text was found. This appears to be an image-only scan; OCR is intentionally not enabled in V1.",
      );
    }

    const [profileResult, rulesResult] = await Promise.all([
      service.from("profiles").select("base_currency").eq("id", user.id).maybeSingle(),
      service
        .from("transaction_category_rules")
        .select("id,match_text,category,transaction_type,priority")
        .eq("user_id", user.id)
        .order("priority", { ascending: false })
        .limit(500),
    ]);

    const extraction: FinancialDocumentExtraction = extractFinancialDocumentDraft({
      documentId: document.id,
      fileName: document.original_name,
      displayName: document.display_name,
      category: document.category,
      documentDate: document.document_date,
      lines,
      baseCurrency: String(profileResult.data?.base_currency || "EUR").toUpperCase(),
      rules: (rulesResult.data ?? []).map((rule) => ({
        id: rule.id,
        match_text: rule.match_text,
        category: rule.category,
        transaction_type:
          rule.transaction_type === "income" ||
          rule.transaction_type === "expense" ||
          rule.transaction_type === "saving"
            ? rule.transaction_type
            : null,
        priority: rule.priority,
      })),
      existingTransactions: [],
    });

    return NextResponse.json(
      { extraction, pageCount: pdf.numPages },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extraction error";
    console.error("Financial document extraction failed", { message });
    if (/password/i.test(message)) {
      return extractionError("Password-protected PDFs cannot be extracted. Save an unlocked copy and try again.");
    }
    if (/timed out/i.test(message)) {
      return extractionError("This PDF took too long to analyse. Try a smaller searchable PDF.", 408);
    }
    return extractionError("FICONTER could not analyse this PDF. Try another searchable PDF.");
  } finally {
    try {
      await disposePdf(pdf);
    } catch {
      // Cleanup failure must not replace a valid extraction response.
    }
  }
}
