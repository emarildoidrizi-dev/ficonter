export function installBusinessAdministrationReadBoundary(client: any) {
  const raw = client as any;
  if (raw.__ficonterBusinessAdministrationReadBoundary) return;
  raw.__ficonterBusinessAdministrationReadBoundary = true;
  const originalFrom = raw.from.bind(raw);

  raw.from = (relation: string) => {
    const builder = originalFrom(relation);
    if (relation !== "business_documents" && relation !== "business_audit_log") return builder;
    return new Proxy(builder, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property === "select" && typeof value === "function") {
          return (...args: unknown[]) => value.call(target, "*");
        }
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  };
}
