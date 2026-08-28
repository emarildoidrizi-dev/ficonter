import {
  decryptBusinessPayload,
  encryptBusinessPayload,
  type BusinessCiphertextEnvelopeV1,
} from "@/lib/e2ee/businessVault";

type State = {
  businessKey: CryptoKey;
  businessId: string;
};

type DeferredCall = { property: PropertyKey; args: unknown[] };
type RecordValue = Record<string, any>;

const PRIVATE_FIELDS = [
  "invoice_number",
  "description",
  "category_name",
  "cost_nature",
  "amount",
  "currency",
  "amount_base",
  "exchange_rate_to_base",
  "exchange_rate_date",
  "exchange_rate_source",
  "issue_date",
  "due_date",
  "payment_method",
  "notes",
] as const;

function deferredMutation(execute: (calls: DeferredCall[]) => Promise<any>) {
  const calls: DeferredCall[] = [];
  let promise: Promise<any> | null = null;
  const run = () => (promise ??= execute(calls));
  const proxy = new Proxy({}, {
    get(_target, property) {
      if (property === "then") return run().then.bind(run());
      if (property === "catch") return run().catch.bind(run());
      if (property === "finally") return run().finally.bind(run());
      return (...args: unknown[]) => {
        calls.push({ property, args });
        return proxy;
      };
    },
  });
  return proxy;
}

function replay(builder: any, calls: DeferredCall[]) {
  let current = builder;
  for (const call of calls) {
    const method = current?.[call.property as any];
    if (typeof method !== "function") throw new Error(`Unsupported supplier invoice mutation step: ${String(call.property)}`);
    current = method.apply(current, call.args);
  }
  return current;
}

function recordIdFromCalls(calls: DeferredCall[]) {
  const match = calls.find(
    (call) => call.property === "eq" && call.args[0] === "id" && typeof call.args[1] === "string",
  );
  return match ? String(match.args[1]) : "";
}

function privatePayload(record: RecordValue) {
  const payload: Record<string, unknown> = {};
  for (const field of PRIVATE_FIELDS) payload[field] = record[field] ?? null;
  return payload;
}

function stripPrivate(record: RecordValue) {
  const next: RecordValue = { ...record, encryption_version: 1 };
  for (const field of PRIVATE_FIELDS) next[field] = null;
  return next;
}

async function encryptInvoice(state: State, record: RecordValue) {
  const id = String(record.id ?? crypto.randomUUID());
  const cipher = await encryptBusinessPayload(
    state.businessKey,
    state.businessId,
    "supplier-invoice",
    id,
    privatePayload(record),
  );
  return stripPrivate({
    ...record,
    id,
    business_id: state.businessId,
    encrypted_payload: cipher,
    encryption_version: 1,
  });
}

async function openInvoice(state: State, row: any) {
  if (!row || row.encryption_version !== 1 || !row.encrypted_payload) return row;
  const payload = await decryptBusinessPayload(
    state.businessKey,
    state.businessId,
    "supplier-invoice",
    String(row.id),
    row.encrypted_payload as BusinessCiphertextEnvelopeV1,
  );
  return { ...row, ...payload };
}

async function openTransaction(state: State, row: any) {
  if (!row || row.encryption_version !== 1 || !row.encrypted_payload) return row;
  const payload = await decryptBusinessPayload(
    state.businessKey,
    state.businessId,
    "transaction",
    String(row.id),
    row.encrypted_payload as BusinessCiphertextEnvelopeV1,
  );
  return { ...row, ...payload };
}

async function openResult(state: State, result: any) {
  if (!result || result.error || result.data == null) return result;
  if (Array.isArray(result.data)) {
    return { ...result, data: await Promise.all(result.data.map((row: any) => openInvoice(state, row))) };
  }
  return { ...result, data: await openInvoice(state, result.data) };
}

function wrapReadBuilder(builder: any, state: State): any {
  return new Proxy(builder, {
    get(target, property, receiver) {
      if (property === "then") {
        return (onFulfilled: any, onRejected: any) =>
          Promise.resolve(target).then((result) => openResult(state, result)).then(onFulfilled, onRejected);
      }
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => wrapReadBuilder(value.apply(target, args), state);
    },
  });
}

export function installBusinessSupplierInvoiceBoundary(
  client: any,
  businessKey: CryptoKey,
  businessId: string,
) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterBusinessSupplierInvoiceBoundary as State | undefined;
  if (existing) {
    existing.businessKey = businessKey;
    existing.businessId = businessId;
    return;
  }

  const state: State = { businessKey, businessId };
  rawClient.__ficonterBusinessSupplierInvoiceBoundary = state;
  const originalFrom = rawClient.from.bind(rawClient);
  const originalRpc = rawClient.rpc.bind(rawClient);
  const originalChannel = rawClient.channel.bind(rawClient);

  rawClient.from = (relation: string) => {
    const builder = originalFrom(relation);
    if (relation !== "business_supplier_invoices") return builder;

    return new Proxy(builder, {
      get(target, property, receiver) {
        const original = Reflect.get(target, property, receiver);
        if (property === "select" && typeof original === "function") {
          return (...args: unknown[]) => wrapReadBuilder(original.apply(target, args), state);
        }
        if ((property === "insert" || property === "upsert") && typeof original === "function") {
          return (value: unknown, ...args: unknown[]) => deferredMutation(async (calls) => {
            const source = Array.isArray(value) ? value : [value];
            const rows = await Promise.all(source.map((item: any) => encryptInvoice(state, item ?? {})));
            let mutation = original.call(target, Array.isArray(value) ? rows : rows[0], ...args);
            mutation = replay(mutation, calls);
            return openResult(state, await mutation);
          });
        }
        if (property === "update" && typeof original === "function") {
          return (value: unknown, ...args: unknown[]) => deferredMutation(async (calls) => {
            const id = String((value as RecordValue)?.id ?? recordIdFromCalls(calls));
            if (!id) throw new Error("Encrypted supplier invoice updates require a record id.");
            const current = await originalFrom("business_supplier_invoices")
              .select("*")
              .eq("id", id)
              .eq("business_id", state.businessId)
              .maybeSingle();
            if (current.error) throw current.error;
            if (!current.data) throw new Error("Supplier invoice could not be found.");
            const opened = await openInvoice(state, current.data);
            const encrypted = await encryptInvoice(state, { ...opened, ...(value as RecordValue), id });
            let mutation = original.call(target, encrypted, ...args);
            mutation = replay(mutation, calls);
            return openResult(state, await mutation);
          });
        }
        return typeof original === "function" ? original.bind(target) : original;
      },
    });
  };

  rawClient.rpc = (fn: string, args?: Record<string, unknown>, options?: unknown) => {
    if (fn !== "record_business_supplier_invoice_payment" && fn !== "reverse_business_supplier_invoice_payment") {
      return originalRpc(fn, args, options);
    }

    return (async () => {
      const invoiceId = String(args?.p_invoice_id ?? "");
      const current = await originalFrom("business_supplier_invoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("business_id", state.businessId)
        .maybeSingle();
      if (current.error || !current.data) {
        return { data: null, error: current.error ?? new Error("Supplier invoice could not be found.") };
      }
      const invoice = await openInvoice(state, current.data);
      const revision = Number(current.data.e2ee_revision ?? 0);

      if (fn === "reverse_business_supplier_invoice_payment") {
        const reversed = await originalRpc("reverse_business_supplier_invoice_payment_e2ee", {
          p_invoice_id: invoiceId,
          p_expected_revision: revision,
        });
        if (reversed.error || !reversed.data) return reversed;
        return {
          data: {
            ...reversed.data,
            invoice: await openInvoice(state, reversed.data.invoice),
          },
          error: null,
        };
      }

      const paidAt = String(args?.p_paid_at ?? new Date().toISOString());
      const paymentMethod = String(args?.p_payment_method ?? invoice.payment_method ?? "Bank transfer");
      const supplierResult = await originalFrom("business_suppliers")
        .select("*")
        .eq("id", invoice.supplier_id)
        .eq("business_id", state.businessId)
        .maybeSingle();
      if (supplierResult.error) return { data: null, error: supplierResult.error };
      const supplier = supplierResult.data;

      const invoicePayload = await encryptBusinessPayload(
        state.businessKey,
        state.businessId,
        "supplier-invoice",
        invoiceId,
        {
          ...privatePayload(invoice),
          payment_method: paymentMethod,
        },
      );

      const transactionId = crypto.randomUUID();
      const transactionPayload = await encryptBusinessPayload(
        state.businessKey,
        state.businessId,
        "transaction",
        transactionId,
        {
          description: invoice.description,
          counterparty: supplier?.name ?? null,
          type: "expense",
          category: invoice.category_name,
          cost_nature: invoice.cost_nature,
          amount: Number(invoice.amount ?? 0),
          currency: invoice.currency,
          amount_base: Number(invoice.amount_base ?? 0),
          exchange_rate_to_base: Number(invoice.exchange_rate_to_base ?? 1),
          exchange_rate_date: invoice.exchange_rate_date ?? paidAt.slice(0, 10),
          exchange_rate_source: "Supplier invoice payment",
          transaction_date: paidAt.slice(0, 10),
          occurred_at: paidAt,
          payment_method: paymentMethod,
          reference: invoice.invoice_number,
          notes: invoice.notes ?? "Supplier invoice payment",
        },
      );

      const paid = await originalRpc("record_business_supplier_invoice_payment_e2ee", {
        p_invoice_id: invoiceId,
        p_expected_revision: revision,
        p_invoice_payload: invoicePayload,
        p_paid_at: paidAt,
        p_transaction_id: transactionId,
        p_transaction_payload: transactionPayload,
      });
      if (paid.error || !paid.data) return paid;
      return {
        data: {
          invoice: await openInvoice(state, paid.data.invoice),
          transaction: await openTransaction(state, paid.data.transaction),
        },
        error: null,
      };
    })();
  };

  rawClient.channel = (...args: any[]) => {
    const channel = originalChannel(...args);
    const originalOn = channel.on.bind(channel);
    channel.on = (type: string, filter: any, callback: any) => {
      if (type !== "postgres_changes" || filter?.table !== "business_supplier_invoices") {
        return originalOn(type, filter, callback);
      }
      return originalOn(type, filter, (payload: any) => {
        void (async () => {
          try {
            const next = payload?.new && payload.eventType !== "DELETE"
              ? await openInvoice(state, payload.new)
              : payload?.new;
            callback({ ...payload, new: next });
          } catch {
            callback(payload);
          }
        })();
      });
    };
    return channel;
  };
}
