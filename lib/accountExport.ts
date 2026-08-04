"use client";

export type AccountExportTable =
  | "transactions"
  | "bills"
  | "goals"
  | "goal_investments"
  | "debts"
  | "debt_payments"
  | "credit_card_activities"
  | "monthly_budget_plans"
  | "monthly_budget_items"
  | "financial_documents"
  | "support_requests"
  | "support_messages"
  | "user_notifications";

export type AccountExportPayload = {
  schema_version: "1.3";
  export_type: "ficonter-account-archive";
  exported_at: string;
  privacy: {
    owner_only: true;
    excludes_authentication_secrets: true;
  };
  account: {
    id: string;
    email: string;
    full_name: string;
    display_name: string;
  };
  preferences: Record<string, unknown>;
  data: Record<AccountExportTable, Record<string, unknown>[]>;
};

export type TransactionPdfRecord = {
  description: string;
  category: string;
  type: string;
  direction: "inflow" | "outflow" | "neutral";
  currency: string;
  amount: number;
  amount_eur: number;
  occurred_at: string;
};

export type TransactionPdfMetadata = {
  ownerName?: string;
  email?: string;
  locale?: string;
  exportedAt?: string;
};

type PdfColumn = {
  label: string;
  width: number;
  align?: "left" | "right";
};

type PdfRow = string[];

type PdfCoverOptions = {
  pageTitle?: string;
  heading?: [string, string];
  aboutTitle?: string;
  aboutText?: string;
};

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const MARGIN = 76;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PAGE_BOTTOM = PAGE_HEIGHT - 100;
const COLORS = {
  paper: "#f7f3ed",
  white: "#fffdf9",
  ink: "#202426",
  muted: "#6e6a64",
  line: "#d8d0c4",
  gold: "#a58a5d",
  darkGold: "#7b6542",
  sage: "#647b70",
  rose: "#9a6666",
};

const encoder = new TextEncoder();

function valueOf(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}

function text(value: unknown, fallback = "-"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currency(value: unknown, code = "EUR", locale = "en-US"): string {
  const safeCode = /^[A-Z]{3}$/.test(code) ? code : "EUR";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: safeCode,
      maximumFractionDigits: 2,
    }).format(numeric(value));
  } catch {
    return `${numeric(value).toFixed(2)} ${safeCode}`;
  }
}

function dateLabel(value: unknown, includeTime = false): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : {}),
  }).format(date);
}

function titleCase(value: unknown): string {
  return text(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function clampText(value: string, max = 140): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function splitWords(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  maxLines = 4,
): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  if (!words[0]) return [""];

  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }

  if (line && lines.length < maxLines) lines.push(line);

  const consumed = lines.join(" ").length;
  if (consumed < value.replace(/\s+/g, " ").trim().length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && context.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }

  return lines;
}

class CanvasReport {
  private readonly pages: HTMLCanvasElement[] = [];
  private canvas!: HTMLCanvasElement;
  private context!: CanvasRenderingContext2D;
  private y = 0;
  private page = 0;
  private continuationTitle = "Private financial report";

  constructor(
    private readonly ownerName: string,
    private readonly exportedAt: string,
    private readonly footerLabel = "Private account export",
  ) {}

  private createPage(title: string): void {
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PDF rendering is not available in this browser.");

    this.canvas = canvas;
    this.context = context;
    this.page += 1;
    this.continuationTitle = title;
    this.pages.push(canvas);

    context.fillStyle = COLORS.paper;
    context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    context.fillStyle = COLORS.ink;
    context.fillRect(0, 0, PAGE_WIDTH, 96);

    context.fillStyle = COLORS.gold;
    context.beginPath();
    context.arc(MARGIN + 23, 48, 22, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = COLORS.white;
    context.font = "700 24px Georgia, serif";
    context.textAlign = "center";
    context.fillText("F", MARGIN + 23, 56);

    context.textAlign = "left";
    context.font = "700 24px Georgia, serif";
    context.fillText("FICONTER", MARGIN + 58, 55);
    context.font = "500 17px Arial, sans-serif";
    context.fillStyle = "#d9d3ca";
    context.fillText(title, MARGIN + 230, 54);

    context.textAlign = "right";
    context.fillText(`Page ${this.page}`, PAGE_WIDTH - MARGIN, 54);
    context.textAlign = "left";

    this.y = 140;
  }

  private drawFooter(): void {
    const context = this.context;
    context.strokeStyle = COLORS.line;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(MARGIN, PAGE_HEIGHT - 68);
    context.lineTo(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 68);
    context.stroke();

    context.fillStyle = COLORS.muted;
    context.font = "500 15px Arial, sans-serif";
    context.textAlign = "left";
    context.fillText(`${this.footerLabel} - generated by FICONTER`, MARGIN, PAGE_HEIGHT - 38);
    context.textAlign = "right";
    context.fillText(dateLabel(this.exportedAt, true), PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 38);
    context.textAlign = "left";
  }

  private ensureSpace(height: number, pageTitle = this.continuationTitle): boolean {
    if (this.y + height <= PAGE_BOTTOM) return false;
    this.drawFooter();
    this.createPage(pageTitle);
    return true;
  }

  cover(
    summary: { label: string; value: string }[],
    email: string,
    options: PdfCoverOptions = {},
  ): void {
    const heading = options.heading ?? ["Private Financial", "Report"];
    this.createPage(options.pageTitle ?? "Private account report");
    const context = this.context;

    context.fillStyle = COLORS.ink;
    context.font = "500 68px Georgia, serif";
    context.fillText(heading[0], MARGIN, 235);
    context.fillText(heading[1], MARGIN, 310);

    context.fillStyle = COLORS.gold;
    context.fillRect(MARGIN, 342, 110, 5);

    context.fillStyle = COLORS.muted;
    context.font = "500 24px Arial, sans-serif";
    context.fillText(this.ownerName, MARGIN, 405);
    context.font = "500 19px Arial, sans-serif";
    if (email) context.fillText(email, MARGIN, 440);
    context.fillText(`Generated ${dateLabel(this.exportedAt, true)}`, MARGIN, email ? 476 : 446);

    context.fillStyle = COLORS.white;
    context.strokeStyle = COLORS.line;
    context.lineWidth = 2;
    const cardGap = 22;
    const cardWidth = (CONTENT_WIDTH - cardGap) / 2;
    const cardHeight = 145;
    let cardY = 560;

    summary.forEach((item, index) => {
      const column = index % 2;
      if (index > 0 && column === 0) cardY += cardHeight + cardGap;
      const x = MARGIN + column * (cardWidth + cardGap);
      context.fillStyle = COLORS.white;
      context.beginPath();
      context.roundRect(x, cardY, cardWidth, cardHeight, 20);
      context.fill();
      context.stroke();

      context.fillStyle = COLORS.gold;
      context.font = "700 16px Arial, sans-serif";
      context.fillText(item.label.toUpperCase(), x + 28, cardY + 42);
      context.fillStyle = COLORS.ink;
      context.font = "600 31px Georgia, serif";
      const lines = splitWords(context, item.value, cardWidth - 56, 2);
      lines.forEach((line, lineIndex) => {
        context.fillText(line, x + 28, cardY + 88 + lineIndex * 34);
      });
    });

    context.fillStyle = "#eee7dc";
    context.beginPath();
    context.roundRect(MARGIN, 1310, CONTENT_WIDTH, 210, 24);
    context.fill();
    context.fillStyle = COLORS.ink;
    context.font = "600 24px Georgia, serif";
    context.fillText(options.aboutTitle ?? "About this export", MARGIN + 32, 1362);
    context.fillStyle = COLORS.muted;
    context.font = "500 19px Arial, sans-serif";
    const privacy =
      options.aboutText ??
      "This report contains financial records belonging only to the signed-in account. Authentication credentials, passwords, session tokens and administrator secrets are never included.";
    splitWords(context, privacy, CONTENT_WIDTH - 64, 4).forEach((line, index) => {
      context.fillText(line, MARGIN + 32, 1404 + index * 29);
    });

    this.drawFooter();
  }

  keyValueSection(title: string, entries: [string, string][]): void {
    this.createPage(title);
    this.sectionHeading(title, `${entries.length} account details`);

    entries.forEach(([label, value]) => {
      this.ensureSpace(72, title);
      const context = this.context;
      context.fillStyle = COLORS.white;
      context.beginPath();
      context.roundRect(MARGIN, this.y, CONTENT_WIDTH, 58, 12);
      context.fill();
      context.strokeStyle = COLORS.line;
      context.stroke();

      context.fillStyle = COLORS.gold;
      context.font = "700 16px Arial, sans-serif";
      context.fillText(label.toUpperCase(), MARGIN + 22, this.y + 36);
      context.fillStyle = COLORS.ink;
      context.font = "500 18px Arial, sans-serif";
      context.textAlign = "right";
      context.fillText(clampText(value, 90), PAGE_WIDTH - MARGIN - 22, this.y + 36);
      context.textAlign = "left";
      this.y += 70;
    });

    this.drawFooter();
  }

  private sectionHeading(title: string, subtitle: string): void {
    const context = this.context;
    context.fillStyle = COLORS.ink;
    context.font = "500 42px Georgia, serif";
    context.fillText(title, MARGIN, this.y + 40);
    context.fillStyle = COLORS.muted;
    context.font = "500 18px Arial, sans-serif";
    context.fillText(subtitle, MARGIN, this.y + 78);
    context.fillStyle = COLORS.gold;
    context.fillRect(MARGIN, this.y + 104, 92, 4);
    this.y += 140;
  }

  table(title: string, subtitle: string, columns: PdfColumn[], rows: PdfRow[]): void {
    this.createPage(title);
    this.sectionHeading(title, subtitle);

    if (!rows.length) {
      const context = this.context;
      context.fillStyle = COLORS.white;
      context.beginPath();
      context.roundRect(MARGIN, this.y, CONTENT_WIDTH, 100, 16);
      context.fill();
      context.strokeStyle = COLORS.line;
      context.stroke();
      context.fillStyle = COLORS.muted;
      context.font = "500 20px Arial, sans-serif";
      context.fillText("No records available for this section.", MARGIN + 28, this.y + 59);
      this.drawFooter();
      return;
    }

    const drawHeader = () => {
      const context = this.context;
      context.fillStyle = COLORS.ink;
      context.beginPath();
      context.roundRect(MARGIN, this.y, CONTENT_WIDTH, 48, 10);
      context.fill();
      let x = MARGIN;
      columns.forEach((column) => {
        context.fillStyle = COLORS.white;
        context.font = "700 15px Arial, sans-serif";
        context.textAlign = column.align === "right" ? "right" : "left";
        const textX = column.align === "right" ? x + column.width - 16 : x + 16;
        context.fillText(column.label.toUpperCase(), textX, this.y + 31);
        x += column.width;
      });
      context.textAlign = "left";
      this.y += 56;
    };

    drawHeader();

    rows.forEach((row, rowIndex) => {
      const context = this.context;
      context.font = "500 17px Arial, sans-serif";
      const wrapped = row.map((cell, index) =>
        splitWords(context, clampText(cell, 180), columns[index].width - 30, 3),
      );
      const maxLines = Math.max(1, ...wrapped.map((lines) => lines.length));
      const rowHeight = Math.max(48, 24 + maxLines * 24);

      const startedNewPage = this.ensureSpace(rowHeight + 8, title);
      if (startedNewPage) {
        this.sectionHeading(`${title} - continued`, `${rows.length} total records`);
        drawHeader();
      }

      context.fillStyle = rowIndex % 2 === 0 ? COLORS.white : "#f0ebe3";
      context.beginPath();
      context.roundRect(MARGIN, this.y, CONTENT_WIDTH, rowHeight, 8);
      context.fill();

      let x = MARGIN;
      wrapped.forEach((lines, columnIndex) => {
        const column = columns[columnIndex];
        context.fillStyle = COLORS.ink;
        context.textAlign = column.align === "right" ? "right" : "left";
        const textX = column.align === "right" ? x + column.width - 16 : x + 16;
        lines.forEach((line, lineIndex) => {
          context.fillText(line, textX, this.y + 31 + lineIndex * 24);
        });
        x += column.width;
      });
      context.textAlign = "left";
      this.y += rowHeight + 8;
    });

    this.drawFooter();
  }

  getPages(): HTMLCanvasElement[] {
    return this.pages;
  }
}

function ascii(value: string): Uint8Array {
  return encoder.encode(value);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

async function canvasJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("A PDF page could not be rendered."))),
      "image/jpeg",
      0.88,
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function imagePdf(images: Uint8Array[]): Blob {
  const objectCount = 2 + images.length * 3;
  const pageReferences = images.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
  const objects = new Map<number, Uint8Array>();

  objects.set(1, ascii("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"));
  objects.set(
    2,
    ascii(`2 0 obj\n<< /Type /Pages /Count ${images.length} /Kids [${pageReferences}] >>\nendobj\n`),
  );

  images.forEach((image, index) => {
    const pageObject = 3 + index * 3;
    const contentObject = pageObject + 1;
    const imageObject = pageObject + 2;
    const stream = "q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n";

    objects.set(
      pageObject,
      ascii(
        `${pageObject} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>\nendobj\n`,
      ),
    );
    objects.set(
      contentObject,
      ascii(
        `${contentObject} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`,
      ),
    );
    objects.set(
      imageObject,
      concatBytes([
        ascii(
          `${imageObject} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${PAGE_WIDTH} /Height ${PAGE_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`,
        ),
        image,
        ascii("\nendstream\nendobj\n"),
      ]),
    );
  });

  const chunks: Uint8Array[] = [ascii("%PDF-1.4\n%FICONTER\n")];
  const offsets = new Array<number>(objectCount + 1).fill(0);
  let offset = chunks[0].length;

  for (let object = 1; object <= objectCount; object += 1) {
    const bytes = objects.get(object);
    if (!bytes) throw new Error("The PDF document could not be assembled.");
    offsets[object] = offset;
    chunks.push(bytes);
    offset += bytes.length;
  }

  const xrefOffset = offset;
  const xref = [
    `xref\n0 ${objectCount + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  ].join("");
  chunks.push(ascii(xref));

  const pdfBytes = concatBytes(chunks);
  const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfBuffer).set(pdfBytes);

  return new Blob([pdfBuffer], { type: "application/pdf" });
}

function reportSummary(payload: AccountExportPayload): { label: string; value: string }[] {
  const transactions = payload.data.transactions;
  const bills = payload.data.bills;
  const goals = payload.data.goals;
  const debts = payload.data.debts;

  const income = transactions
    .filter((item) => String(valueOf(item, "type")) === "income")
    .reduce((total, item) => total + numeric(valueOf(item, "amount_eur") ?? valueOf(item, "amount")), 0);
  const outflow = transactions
    .filter((item) => String(valueOf(item, "type")) !== "income")
    .reduce((total, item) => total + numeric(valueOf(item, "amount_eur") ?? valueOf(item, "amount")), 0);
  const liabilities = debts
    .filter((item) => String(valueOf(item, "status")) !== "paid_off")
    .reduce((total, item) => total + numeric(valueOf(item, "current_balance_eur") ?? valueOf(item, "current_balance")), 0);
  const pendingBills = bills
    .filter((item) => String(valueOf(item, "status")) === "pending")
    .reduce((total, item) => total + numeric(valueOf(item, "amount_eur") ?? valueOf(item, "amount")), 0);
  const goalTarget = goals.reduce((total, item) => total + numeric(valueOf(item, "target_amount")), 0);
  const goalSaved = goals.reduce((total, item) => total + numeric(valueOf(item, "current_amount")), 0);
  const cash = income - outflow;

  return [
    { label: "Recorded cash position", value: currency(cash, "EUR") },
    { label: "Outstanding liabilities", value: currency(liabilities, "EUR") },
    { label: "Net financial position", value: currency(cash - liabilities, "EUR") },
    { label: "Pending bills", value: currency(pendingBills, "EUR") },
    { label: "Goal progress", value: goalTarget ? `${Math.min(100, (goalSaved / goalTarget) * 100).toFixed(1)}%` : "No active target" },
    { label: "Financial records", value: String(Object.values(payload.data).reduce((total, rows) => total + rows.length, 0)) },
  ];
}

export async function createAccountPdf(payload: AccountExportPayload): Promise<Blob> {
  const ownerName = payload.account.display_name || payload.account.full_name || "FICONTER account holder";
  const report = new CanvasReport(ownerName, payload.exported_at);
  const locale = text(payload.preferences.numberFormat, "en-US");
  const preferredCurrency = text(payload.preferences.currency, "EUR");

  report.cover(reportSummary(payload), payload.account.email);

  report.keyValueSection("Account & preferences", [
    ["Display name", payload.account.display_name || "-"],
    ["Full name", payload.account.full_name || "-"],
    ["Email", payload.account.email],
    ["Preferred currency", preferredCurrency],
    ["Number format", locale],
    ["Date format", text(payload.preferences.dateFormat)],
    ["Week starts", titleCase(payload.preferences.weekStart)],
    ["Appearance", titleCase(payload.preferences.appearance)],
    ["Layout density", titleCase(payload.preferences.density)],
    ["Export schema", payload.schema_version],
  ]);

  report.table(
    "Transactions",
    `${payload.data.transactions.length} exported transactions`,
    [
      { label: "Date", width: 145 },
      { label: "Description", width: 310 },
      { label: "Type", width: 160 },
      { label: "Category", width: 215 },
      { label: "Amount", width: 258, align: "right" },
    ],
    payload.data.transactions.map((item) => [
      dateLabel(valueOf(item, "occurred_at") ?? valueOf(item, "transaction_date")),
      text(valueOf(item, "description")),
      titleCase(valueOf(item, "type")),
      text(valueOf(item, "category")),
      currency(valueOf(item, "amount"), text(valueOf(item, "currency"), preferredCurrency), locale),
    ]),
  );

  report.table(
    "Bills",
    `${payload.data.bills.length} exported bills`,
    [
      { label: "Due", width: 145 },
      { label: "Bill", width: 315 },
      { label: "Category", width: 220 },
      { label: "Status", width: 145 },
      { label: "Amount", width: 263, align: "right" },
    ],
    payload.data.bills.map((item) => [
      dateLabel(valueOf(item, "due_date")),
      [text(valueOf(item, "name")), text(valueOf(item, "company"), "")].filter(Boolean).join(" - "),
      text(valueOf(item, "category")),
      titleCase(valueOf(item, "status")),
      currency(valueOf(item, "amount"), text(valueOf(item, "currency"), preferredCurrency), locale),
    ]),
  );

  report.table(
    "Goals",
    `${payload.data.goals.length} exported goals`,
    [
      { label: "Goal", width: 330 },
      { label: "Status", width: 160 },
      { label: "Saved", width: 215, align: "right" },
      { label: "Target", width: 215, align: "right" },
      { label: "Target date", width: 168 },
    ],
    payload.data.goals.map((item) => [
      text(valueOf(item, "name")),
      titleCase(valueOf(item, "status")),
      currency(valueOf(item, "current_amount"), "EUR", locale),
      currency(valueOf(item, "target_amount"), "EUR", locale),
      dateLabel(valueOf(item, "target_date")),
    ]),
  );

  const goalNames = new Map(
    payload.data.goals.map((item) => [text(valueOf(item, "id"), ""), text(valueOf(item, "name"))]),
  );
  report.table(
    "Goal investments",
    `${payload.data.goal_investments.length} exported contributions`,
    [
      { label: "Date", width: 165 },
      { label: "Goal", width: 315 },
      { label: "Notes", width: 355 },
      { label: "Amount", width: 253, align: "right" },
    ],
    payload.data.goal_investments.map((item) => [
      dateLabel(valueOf(item, "invested_at")),
      goalNames.get(text(valueOf(item, "goal_id"), "")) ?? "Goal",
      text(valueOf(item, "notes")),
      currency(valueOf(item, "amount"), "EUR", locale),
    ]),
  );

  report.table(
    "Debts",
    `${payload.data.debts.length} exported debt accounts`,
    [
      { label: "Debt", width: 285 },
      { label: "Lender", width: 235 },
      { label: "Status", width: 150 },
      { label: "APR", width: 125, align: "right" },
      { label: "Balance", width: 293, align: "right" },
    ],
    payload.data.debts.map((item) => [
      text(valueOf(item, "name")),
      text(valueOf(item, "lender")),
      titleCase(valueOf(item, "status")),
      `${numeric(valueOf(item, "annual_interest_rate")).toFixed(2)}%`,
      currency(valueOf(item, "current_balance"), text(valueOf(item, "currency"), preferredCurrency), locale),
    ]),
  );

  const debtNames = new Map(
    payload.data.debts.map((item) => [text(valueOf(item, "id"), ""), text(valueOf(item, "name"))]),
  );
  report.table(
    "Debt payments",
    `${payload.data.debt_payments.length} exported payments`,
    [
      { label: "Date", width: 175 },
      { label: "Debt", width: 315 },
      { label: "Notes", width: 345 },
      { label: "Amount", width: 253, align: "right" },
    ],
    payload.data.debt_payments.map((item) => [
      dateLabel(valueOf(item, "paid_at")),
      debtNames.get(text(valueOf(item, "debt_id"), "")) ?? "Debt",
      text(valueOf(item, "notes")),
      currency(valueOf(item, "amount"), text(valueOf(item, "currency"), preferredCurrency), locale),
    ]),
  );

  report.table(
    "Credit-card activity",
    `${payload.data.credit_card_activities.length} exported card activities`,
    [
      { label: "Date", width: 165 },
      { label: "Credit card", width: 275 },
      { label: "Activity", width: 210 },
      { label: "Description", width: 300 },
      { label: "Balance effect", width: 138, align: "right" },
    ],
    payload.data.credit_card_activities.map((item) => [
      dateLabel(valueOf(item, "occurred_at"), true),
      debtNames.get(text(valueOf(item, "debt_id"), "")) ?? "Credit card",
      titleCase(valueOf(item, "activity_type")),
      text(valueOf(item, "description")),
      currency(
        valueOf(item, "balance_effect"),
        text(valueOf(item, "currency"), preferredCurrency),
        locale,
      ),
    ]),
  );

  report.table(
    "Monthly planner",
    `${payload.data.monthly_budget_plans.length} exported monthly plans`,
    [
      { label: "Month", width: 280 },
      { label: "Starting balance", width: 360, align: "right" },
      { label: "Created", width: 230 },
      { label: "Updated", width: 218 },
    ],
    payload.data.monthly_budget_plans.map((item) => [
      text(valueOf(item, "month")),
      currency(valueOf(item, "start_balance"), preferredCurrency, locale),
      dateLabel(valueOf(item, "created_at")),
      dateLabel(valueOf(item, "updated_at")),
    ]),
  );

  report.table(
    "Planner items",
    `${payload.data.monthly_budget_items.length} exported planner entries`,
    [
      { label: "Month", width: 145 },
      { label: "Section", width: 190 },
      { label: "Item", width: 490 },
      { label: "Planned", width: 263, align: "right" },
    ],
    payload.data.monthly_budget_items.map((item) => [
      text(valueOf(item, "month")),
      titleCase(valueOf(item, "section")),
      text(valueOf(item, "label")),
      currency(valueOf(item, "planned_amount"), preferredCurrency, locale),
    ]),
  );

  const images = await Promise.all(report.getPages().map(canvasJpeg));
  return imagePdf(images);
}

export async function createTransactionsPdf(
  transactions: TransactionPdfRecord[],
  metadata: TransactionPdfMetadata = {},
): Promise<Blob> {
  const exportedAt = metadata.exportedAt ?? new Date().toISOString();
  const ownerName = metadata.ownerName?.trim() || "FICONTER account holder";
  const locale = metadata.locale || "en-US";
  const report = new CanvasReport(ownerName, exportedAt, "Private transaction export");

  const totals = transactions.reduce(
    (summary, transaction) => {
      if (transaction.direction === "inflow") summary.inflow += transaction.amount_eur;
      else if (transaction.direction === "outflow") summary.outflow += transaction.amount_eur;
      summary.net +=
        transaction.direction === "inflow"
          ? transaction.amount_eur
          : transaction.direction === "outflow"
            ? -transaction.amount_eur
            : 0;
      summary.currencies.add(transaction.currency || "EUR");
      return summary;
    },
    { inflow: 0, outflow: 0, net: 0, currencies: new Set<string>() },
  );

  report.cover(
    [
      { label: "Exported transactions", value: String(transactions.length) },
      { label: "Money received", value: currency(totals.inflow, "EUR", locale) },
      { label: "Money spent", value: currency(totals.outflow, "EUR", locale) },
      { label: "Net movement", value: currency(totals.net, "EUR", locale) },
      { label: "Reporting currency", value: "EUR" },
      { label: "Original currencies", value: totals.currencies.size ? [...totals.currencies].sort().join(", ") : "-" },
    ],
    metadata.email?.trim() || "",
    {
      pageTitle: "Transaction ledger",
      heading: ["Transaction", "Ledger"],
      aboutTitle: "About this ledger",
      aboutText:
        "This PDF contains the transactions currently included by your ledger filters and sort order. It belongs only to the signed-in account and never includes passwords, authentication tokens or administrator secrets.",
    },
  );

  report.table(
    "Transaction ledger",
    `${transactions.length} exported transactions - values normalized to EUR`,
    [
      { label: "Date & time", width: 175 },
      { label: "Description", width: 270 },
      { label: "Type", width: 145 },
      { label: "Category", width: 190 },
      { label: "Original", width: 145, align: "right" },
      { label: "EUR value", width: 163, align: "right" },
    ],
    transactions.map((transaction) => {
      const sign =
        transaction.direction === "inflow" ? 1 : transaction.direction === "outflow" ? -1 : 0;
      const signedOriginal = sign === 0 ? transaction.amount : transaction.amount * sign;
      const signedEuro = sign === 0 ? transaction.amount_eur : transaction.amount_eur * sign;
      return [
        dateLabel(transaction.occurred_at, true),
        transaction.description,
        titleCase(transaction.type),
        transaction.category,
        currency(signedOriginal, transaction.currency || "EUR", locale),
        currency(signedEuro, "EUR", locale),
      ];
    }),
  );

  const images = await Promise.all(report.getPages().map(canvasJpeg));
  return imagePdf(images);
}

export function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
