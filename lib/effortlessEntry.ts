export type EntryMode = "simple" | "guided" | "detailed";

export type TransactionPreset = {
  key: string;
  label: string;
  description: string;
  amount: number;
  currency: string;
  type: "expense" | "income" | "saving";
  category: string;
  occurredAt?: string;
  templateId?: string;
  periodKey?: string;
};

export type TransactionTemplate = {
  id: string;
  user_id: string;
  label: string;
  description: string;
  amount: number | string;
  currency: string;
  amount_eur: number | string | null;
  exchange_rate_to_eur: number | string | null;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
  type: "expense" | "income" | "saving";
  category: string;
  is_favorite: boolean;
  is_recurring: boolean;
  day_of_month: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TransactionForPreset = {
  id: string;
  description: string;
  amount: number | string;
  currency: string;
  type: string;
  category: string;
  occurred_at?: string | null;
  transaction_date: string;
};

export const ENTRY_MODE_OPTIONS: Array<{
  value: EntryMode;
  label: string;
  description: string;
}> = [
  {
    value: "simple",
    label: "Simple",
    description: "Only the essentials for a quick monthly overview.",
  },
  {
    value: "guided",
    label: "Guided",
    description: "Fast entry with helpful details when you need them.",
  },
  {
    value: "detailed",
    label: "Detailed",
    description: "Full transaction information and precise timing.",
  },
];

export function currentPeriodKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function recurringDateTime(dayOfMonth: number, date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(Math.max(Math.round(dayOfMonth), 1), lastDay);
  const scheduled = new Date(year, month, day, 12, 0, 0, 0);
  const offset = scheduled.getTimezoneOffset();
  return new Date(scheduled.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function normalizedType(value: string): "expense" | "income" | "saving" {
  if (value === "income" || value === "saving") return value;
  return "expense";
}

export function templateToPreset(
  template: TransactionTemplate,
  periodKey?: string,
): TransactionPreset {
  return {
    key: `template:${template.id}:${periodKey ?? "favorite"}`,
    label: template.label,
    description: template.description,
    amount: Number(template.amount),
    currency: template.currency || "EUR",
    type: normalizedType(template.type),
    category: template.category,
    occurredAt:
      template.is_recurring && template.day_of_month
        ? recurringDateTime(template.day_of_month)
        : undefined,
    templateId: template.is_recurring ? template.id : undefined,
    periodKey: template.is_recurring ? periodKey : undefined,
  };
}

export function createRecentPresets(
  transactions: TransactionForPreset[],
  limit = 5,
): TransactionPreset[] {
  const seen = new Set<string>();
  const presets: TransactionPreset[] = [];

  for (const transaction of transactions) {
    const type = normalizedType(transaction.type);
    const currency = transaction.currency || "EUR";
    const signature = [
      transaction.description.trim().toLowerCase(),
      transaction.category.trim().toLowerCase(),
      type,
      currency,
    ].join("|");

    if (seen.has(signature)) continue;
    seen.add(signature);

    presets.push({
      key: `recent:${transaction.id}`,
      label: transaction.description,
      description: transaction.description,
      amount: Number(transaction.amount),
      currency,
      type,
      category: transaction.category,
    });

    if (presets.length >= limit) break;
  }

  return presets;
}

export function isTemplateDueThisMonth(
  template: TransactionTemplate,
  postedTemplateIds: Set<string>,
  date = new Date(),
): boolean {
  if (!template.is_active || !template.is_recurring || !template.day_of_month) return false;
  if (postedTemplateIds.has(template.id)) return false;

  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const scheduledDay = Math.min(template.day_of_month, lastDay);
  return scheduledDay <= date.getDate();
}
