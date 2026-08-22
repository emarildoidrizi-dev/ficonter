import {
  decryptBusinessPayload,
  encryptBusinessPayload,
  type BusinessCiphertextEnvelopeV1,
} from "@/lib/e2ee/businessVault";

type BoundaryState = {
  businessKey: CryptoKey;
  businessId: string;
};

type DeferredCall = { property: PropertyKey; args: unknown[] };
type RecordValue = Record<string, any>;

type TableConfig = {
  recordType: string;
  privateFields: readonly string[];
};

const TABLES: Record<string, TableConfig> = {
  business_transactions: {
    recordType: "transaction",
    privateFields: [
      "description", "counterparty", "type", "category", "cost_nature",
      "amount", "currency", "amount_base", "exchange_rate_to_base",
      "exchange_rate_date", "exchange_rate_source", "transaction_date",
      "occurred_at", "payment_method", "reference", "notes",
    ],
  },
  business_cost_categories: {
    recordType: "cost-category",
    privateFields: ["name", "description", "default_nature"],
  },
  business_cost_centres: {
    recordType: "cost-centre",
    privateFields: ["name", "description"],
  },
  business_suppliers: {
    recordType: "supplier",
    privateFields: [
      "name", "legal_name", "supplier_code", "category", "contact_name",
      "email", "phone", "website", "tax_id", "payment_terms_days",
      "default_currency", "address_line1", "address_line2", "city",
      "postal_code", "country_code", "notes",
    ],
  },
};

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
    if (typeof method !== "function") throw new Error(`Unsupported business mutation step: ${String(call.property)}`);
    current = method.apply(current, call.args);
  }
  return current;
}

function privatePayload(config: TableConfig, record: RecordValue) {
  const payload: Record<string, unknown> = {};
  for (const field of config.privateFields) payload[field] = record[field] ?? null;
  return payload;
}

function stripPrivate(config: TableConfig, record: RecordValue) {
  const next: RecordValue = { ...record, encryption_version: 1 };
  for (const field of config.privateFields) next[field] = null;
  return next;
}

async function encryptRow(
  state: BoundaryState,
  table: string,
  record: RecordValue,
) {
  const config = TABLES[table];
  const id = String(record.id ?? crypto.randomUUID());
  const encryptedPayload = await encryptBusinessPayload(
    state.businessKey,
    state.businessId,
    config.recordType,
    id,
    privatePayload(config, record),
  );
  return stripPrivate(config, {
    ...record,
    id,
    business_id: state.businessId,
    encrypted_payload: encryptedPayload,
    encryption_version: 1,
  });
}

async function openRow(state: BoundaryState, table: string, row: any) {
  if (!row || row.encryption_version !== 1 || !row.encrypted_payload) return row;
  const config = TABLES[table];
  const payload = await decryptBusinessPayload(
    state.businessKey,
    state.businessId,
    config.recordType,
    String(row.id),
    row.encrypted_payload as BusinessCiphertextEnvelopeV1,
  );
  return { ...row, ...payload };
}

async function openResult(state: BoundaryState, table: string, result: any) {
  if (!result || result.error || result.data == null) return result;
  if (Array.isArray(result.data)) {
    return { ...result, data: await Promise.all(result.data.map((row: any) => openRow(state, table, row))) };
  }
  return { ...result, data: await openRow(state, table, result.data) };
}

function wrapReadBuilder(builder: any, state: BoundaryState, table: string): any {
  return new Proxy(builder, {
    get(target, property, receiver) {
      if (property === "then") {
        return (onFulfilled: any, onRejected: any) =>
          Promise.resolve(target)
            .then((result) => openResult(state, table, result))
            .then(onFulfilled, onRejected);
      }
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => wrapReadBuilder(value.apply(target, args), state, table);
    },
  });
}

export function installBusinessE2eeBoundary(
  client: any,
  businessKey: CryptoKey,
  businessId: string,
) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterBusinessE2eeBoundary as BoundaryState | undefined;
  if (existing) {
    existing.businessKey = businessKey;
    existing.businessId = businessId;
    return;
  }

  const state: BoundaryState = { businessKey, businessId };
  rawClient.__ficonterBusinessE2eeBoundary = state;
  const originalFrom = rawClient.from.bind(rawClient);
  const originalChannel = rawClient.channel.bind(rawClient);

  rawClient.from = (relation: string) => {
    const builder = originalFrom(relation);
    const config = TABLES[relation];
    if (!config) return builder;

    return new Proxy(builder, {
      get(target, property, receiver) {
        const original = Reflect.get(target, property, receiver);

        if (property === "select" && typeof original === "function") {
          return (...args: unknown[]) => wrapReadBuilder(original.apply(target, args), state, relation);
        }

        if ((property === "insert" || property === "upsert") && typeof original === "function") {
          return (value: unknown, ...args: unknown[]) => deferredMutation(async (calls) => {
            const source = Array.isArray(value) ? value : [value];
            const rows = await Promise.all(source.map((item: any) => encryptRow(state, relation, item ?? {})));
            let mutation = original.call(target, Array.isArray(value) ? rows : rows[0], ...args);
            mutation = replay(mutation, calls);
            return openResult(state, relation, await mutation);
          });
        }

        if (property === "update" && typeof original === "function") {
          return (value: unknown, ...args: unknown[]) => deferredMutation(async (calls) => {
            const row = await encryptRow(state, relation, value as RecordValue);
            let mutation = original.call(target, row, ...args);
            mutation = replay(mutation, calls);
            return openResult(state, relation, await mutation);
          });
        }

        return typeof original === "function" ? original.bind(target) : original;
      },
    });
  };

  rawClient.channel = (...args: any[]) => {
    const channel = originalChannel(...args);
    const originalOn = channel.on.bind(channel);
    channel.on = (type: string, filter: any, callback: any) => {
      if (type !== "postgres_changes" || !filter?.table || !TABLES[filter.table]) {
        return originalOn(type, filter, callback);
      }
      const table = String(filter.table);
      return originalOn(type, filter, (payload: any) => {
        void (async () => {
          try {
            const next = payload?.new && payload.eventType !== "DELETE"
              ? await openRow(state, table, payload.new)
              : payload?.new;
            const previous = payload?.old && payload.eventType === "UPDATE"
              ? await openRow(state, table, payload.old)
              : payload?.old;
            callback({ ...payload, new: next, old: previous });
          } catch {
            callback(payload);
          }
        })();
      });
    };
    return channel;
  };
}
