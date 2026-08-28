import { encryptTransactionPayload } from "@/lib/e2ee/transactionPayload";

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isoDate(value: unknown) {
  const text = typeof value === "string" ? value : "";
  return text ? text.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

export async function finalizePendingTemplateTransactions(
  supabase: any,
  vaultKey: CryptoKey,
  userId: string,
): Promise<number> {
  const { data: pending, error: pendingError } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("encryption_version", 0)
    .is("encrypted_payload", null)
    .limit(1000);

  if (pendingError) throw pendingError;
  const ids = (pending ?? []).map((row: any) => row.id);
  if (!ids.length) return 0;

  const { data: postings, error: postingsError } = await supabase
    .from("transaction_template_postings")
    .select("id,template_id,period_key,transaction_id")
    .eq("user_id", userId)
    .in("transaction_id", ids);
  if (postingsError) throw postingsError;
  if (!(postings ?? []).length) return 0;

  const templateIds = [...new Set((postings ?? []).map((row: any) => row.template_id))];
  const { data: templates, error: templatesError } = await supabase
    .from("transaction_templates")
    .select("id,description,amount,currency,amount_eur,exchange_rate_to_eur,exchange_rate_date,exchange_rate_source,type,category,day_of_month")
    .eq("user_id", userId)
    .in("id", templateIds);
  if (templatesError) throw templatesError;

  const templatesById = new Map((templates ?? []).map((row: any) => [row.id, row]));
  let finalized = 0;

  for (const posting of postings ?? []) {
    const template: any = templatesById.get(posting.template_id);
    if (!template || !posting.transaction_id) continue;

    const period = isoDate(posting.period_key);
    const [year, month] = period.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = Math.min(Math.max(1, num(template.day_of_month, 1)), lastDay);
    const transactionDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const encryptedPayload = await encryptTransactionPayload(vaultKey, userId, {
      description: String(template.description ?? "Recurring transaction"),
      amount: num(template.amount),
      currency: String(template.currency ?? "EUR").toUpperCase(),
      amount_eur: num(template.amount_eur ?? template.amount),
      exchange_rate_to_eur: num(template.exchange_rate_to_eur, 1),
      exchange_rate_date: template.exchange_rate_date ?? transactionDate,
      exchange_rate_source: template.exchange_rate_source ?? "recurring template",
      type: String(template.type ?? "expense"),
      category: String(template.category ?? "Other"),
      transaction_date: transactionDate,
      occurred_at: `${transactionDate}T12:00:00.000Z`,
    });

    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        encrypted_payload: encryptedPayload,
        encryption_version: 1,
        description: null,
        amount: null,
        currency: null,
        amount_eur: null,
        exchange_rate_to_eur: null,
        exchange_rate_date: null,
        exchange_rate_source: null,
        type: null,
        category: null,
        transaction_date: null,
        occurred_at: null,
      })
      .eq("id", posting.transaction_id)
      .eq("user_id", userId)
      .eq("encryption_version", 0);

    if (updateError) throw updateError;
    finalized += 1;
  }

  return finalized;
}
