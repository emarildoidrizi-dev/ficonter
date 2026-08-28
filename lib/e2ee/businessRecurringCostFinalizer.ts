import { encryptBusinessPayload } from "@/lib/e2ee/businessVault";

function localDateInTimezone(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function finalizePendingBusinessRecurringCosts(
  client: any,
  businessKey: CryptoKey,
  businessId: string,
) {
  const { data: runs, error: runsError } = await client
    .from("business_recurring_cost_runs")
    .select("id,business_id,recurring_cost_id,occurrence_key,scheduled_for,status")
    .eq("business_id", businessId)
    .eq("status", "pending")
    .order("scheduled_for", { ascending: true })
    .limit(250);
  if (runsError) throw runsError;

  let completed = 0;
  for (const run of runs ?? []) {
    const { data: cost, error: costError } = await client
      .from("business_recurring_costs")
      .select("*")
      .eq("id", run.recurring_cost_id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (costError) throw costError;
    if (!cost) continue;

    const transactionId = crypto.randomUUID();
    const transactionDate = localDateInTimezone(run.scheduled_for, cost.timezone || "UTC");
    const encryptedPayload = await encryptBusinessPayload(
      businessKey,
      businessId,
      "transaction",
      transactionId,
      {
        description: cost.name,
        counterparty: cost.supplier ?? null,
        type: "expense",
        category: cost.category_name,
        cost_nature: cost.cost_nature,
        amount: Number(cost.amount ?? 0),
        currency: cost.currency,
        amount_base: Number(cost.amount_base ?? 0),
        exchange_rate_to_base: Number(cost.exchange_rate_to_base ?? 1),
        exchange_rate_date: cost.exchange_rate_date ?? transactionDate,
        exchange_rate_source: cost.exchange_rate_source ?? "Automatic business recurring cost",
        transaction_date: transactionDate,
        occurred_at: run.scheduled_for,
        payment_method: cost.payment_method ?? null,
        reference: cost.reference ?? null,
        notes: cost.notes ?? "Automatic monthly business cost",
      },
    );

    const { error: finalizeError } = await client.rpc(
      "finalize_business_recurring_cost_run_e2ee",
      {
        p_run_id: run.id,
        p_transaction_id: transactionId,
        p_transaction_payload: encryptedPayload,
      },
    );
    if (finalizeError) throw finalizeError;
    completed += 1;
  }

  return completed;
}
