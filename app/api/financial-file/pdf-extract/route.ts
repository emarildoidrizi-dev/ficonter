import { NextRequest, NextResponse } from "next/server";
import { extractText, extractTextItems, getDocumentProxy } from "unpdf";
import {
  extractTransactionsFromPdfLines,
  groupPdfTextItemsIntoLines,
  type PdfTextItem,
} from "@/lib/pdfFinancialImport";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// Vercel Functions accept a maximum request payload of 4.5 MB. Multipart
// uploads add overhead, so the application limit remains safely below it.
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 80;
const MAX_ROWS = 2000;
const EXTRACTION_TIMEOUT_MS = 20_000;

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "The PDF could not be read.";
  const normalized = message.toLowerCase();

  if (normalized.includes("password")) {
    return NextResponse.json(
      { error: "Password-protected PDFs cannot be imported. Export an unlocked copy and try again." },
      { status: 422, headers: noStoreHeaders() },
    );
  }
  if (normalized.includes("invalid pdf") || normalized.includes("missing pdf")) {
    return NextResponse.json(
      { error: "This file is not a readable PDF." },
      { status: 422, headers: noStoreHeaders() },
    );
  }
  if (normalized.includes("timed out")) {
    return NextResponse.json(
      { error: "This PDF took too long to analyse. Try a smaller searchable PDF or export the records as CSV." },
      { status: 408, headers: noStoreHeaders() },
    );
  }

  return NextResponse.json(
    { error: "The PDF could not be analysed. Try a searchable PDF under 4 MB or export the records as CSV." },
    { status: 422, headers: noStoreHeaders() },
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("PDF extraction timed out.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

type DisposablePdfDocument = {
  destroy?: () => void | Promise<void>;
  cleanup?: () => void | Promise<void>;
};

async function disposePdfDocument(document: unknown) {
  const disposable = document as DisposablePdfDocument | null;
  if (!disposable) return;

  if (typeof disposable.destroy === "function") {
    await disposable.destroy();
    return;
  }

  if (typeof disposable.cleanup === "function") {
    await disposable.cleanup();
  }
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

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "This request could not be verified." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in again before importing a financial file." },
        { status: 401, headers: noStoreHeaders() },
      );
    }

    const formData = await request.formData();
    const value = formData.get("file");
    if (!(value instanceof File)) {
      return NextResponse.json(
        { error: "Choose a PDF file." },
        { status: 400, headers: noStoreHeaders() },
      );
    }
    if (value.type !== "application/pdf" && !value.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files can use PDF extraction." },
        { status: 400, headers: noStoreHeaders() },
      );
    }
    if (value.size <= 0 || value.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: "Choose a searchable PDF smaller than 4 MB." },
        { status: 413, headers: noStoreHeaders() },
      );
    }

    const buffer = new Uint8Array(await value.arrayBuffer());
    pdf = await withTimeout(
      getDocumentProxy(buffer, {
        maxImageSize: 16_777_216,
        disableAutoFetch: true,
        disableStream: true,
      }),
      EXTRACTION_TIMEOUT_MS,
    );

    if (pdf.numPages > MAX_PAGES) {
      return NextResponse.json(
        { error: `Import a PDF with no more than ${MAX_PAGES} pages at a time.` },
        { status: 413, headers: noStoreHeaders() },
      );
    }

    const positioned = await withTimeout(extractTextItems(pdf), EXTRACTION_TIMEOUT_MS);
    let lines = positionedItemsToLines(positioned.items);

    // Some PDFs expose text without reliable position metadata. Keep a plain-text
    // fallback so valid searchable PDFs do not fail solely because of their layout.
    if (!lines.length) {
      const plain = await withTimeout(extractText(pdf, { mergePages: false }), EXTRACTION_TIMEOUT_MS);
      const pages = Array.isArray(plain.text) ? plain.text : [plain.text];
      lines = pages.flatMap((page) => page.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    }

    if (!lines.length) {
      return NextResponse.json(
        {
          error:
            "No readable text was found. Scanned image-only PDFs are not supported yet; use a searchable PDF or CSV export.",
        },
        { status: 422, headers: noStoreHeaders() },
      );
    }

    const extracted = extractTransactionsFromPdfLines(lines, MAX_ROWS);
    if (extracted.transactionCount === 0) {
      return NextResponse.json(
        { error: "No transaction rows were detected in this PDF. Try another report or export the records as CSV." },
        { status: 422, headers: noStoreHeaders() },
      );
    }

    return NextResponse.json(
      {
        ...extracted,
        pageCount: pdf.numPages,
        fileName: value.name,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("Financial PDF extraction failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return errorResponse(error);
  } finally {
    try {
      await disposePdfDocument(pdf);
    } catch {
      // The response result is more important than cleanup failure.
    }
  }
}
