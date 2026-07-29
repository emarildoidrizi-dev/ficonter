import { NextRequest, NextResponse } from "next/server";
import { extractTransactionsFromPdfLines, groupPdfTextItemsIntoLines, type PdfTextItem } from "@/lib/pdfFinancialImport";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 80;
const MAX_ROWS = 2000;

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
  return NextResponse.json(
    { error: "The PDF could not be analysed. Try a searchable PDF or export the records as CSV." },
    { status: 422, headers: noStoreHeaders() },
  );
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "This request could not be verified." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
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
        { error: "Choose a PDF smaller than 10 MB." },
        { status: 413, headers: noStoreHeaders() },
      );
    }

    const buffer = new Uint8Array(await value.arrayBuffer());
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: buffer,
      disableFontFace: true,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;

    try {
      if (pdf.numPages > MAX_PAGES) {
        return NextResponse.json(
          { error: `Import a PDF with no more than ${MAX_PAGES} pages at a time.` },
          { status: 413, headers: noStoreHeaders() },
        );
      }

      const lines: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent({ disableNormalization: false });
        lines.push(...groupPdfTextItemsIntoLines(content.items as PdfTextItem[]));
        page.cleanup();
      }

      if (!lines.length) {
        return NextResponse.json(
          { error: "No readable text was found. Scanned image-only PDFs are not supported yet; use a searchable PDF or CSV export." },
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
    } finally {
      await loadingTask.destroy();
    }
  } catch (error) {
    console.error("Financial PDF extraction failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return errorResponse(error);
  }
}
