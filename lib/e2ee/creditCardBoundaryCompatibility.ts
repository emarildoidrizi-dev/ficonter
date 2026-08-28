type RecordValue = Record<string, unknown>;

function withCreditCardMarker(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as RecordValue;
  if (
    record.debt_kind === "credit_card" &&
    record.encryption_version === 1 &&
    record.encrypted_payload
  ) {
    return { ...record, category: "Credit card" };
  }
  return value;
}

export function installCreditCardDebtBoundaryCompatibility(client: any) {
  const rawClient = client as any;
  if (rawClient.__ficonterCreditCardDebtCompatibility) return;

  const previousFrom = rawClient.from.bind(rawClient);
  rawClient.from = (relation: string) => {
    const builder = previousFrom(relation);
    if (relation !== "debts") return builder;

    return new Proxy(builder, {
      get(target, property, receiver) {
        const original = Reflect.get(target, property, receiver);
        if (
          (property === "insert" || property === "update" || property === "upsert") &&
          typeof original === "function"
        ) {
          return (value: unknown, ...args: unknown[]) => {
            const next = Array.isArray(value)
              ? value.map((item) => withCreditCardMarker(item))
              : withCreditCardMarker(value);
            return original.call(target, next, ...args);
          };
        }
        return typeof original === "function" ? original.bind(target) : original;
      },
    });
  };

  rawClient.__ficonterCreditCardDebtCompatibility = true;
}
