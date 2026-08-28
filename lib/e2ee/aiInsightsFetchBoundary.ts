import {
  calculateAiInsightsContext,
  generateSmartInsightReport,
  normalizeAiInsightReport,
  normalizeAiInsightsInputs,
} from "@/lib/wealth/aiInsights";
import {
  clearAiInsightSnapshots,
  saveAiInsightSnapshotToVault,
} from "@/lib/e2ee/aiInsightSnapshotSource";

type BoundaryState = {
  client: any;
  vaultKey: CryptoKey;
  userId: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return "GET";
}

async function requestBody(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof init?.body === "string") return init.body;
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.clone().text();
  }
  return "";
}

export function installSmartInsightsFetchE2eeBoundary(
  client: any,
  vaultKey: CryptoKey,
  userId: string,
) {
  if (typeof window === "undefined") return;

  const target = window as typeof window & {
    __ficonterSmartInsightsFetchBoundary?: BoundaryState;
    __ficonterSmartInsightsOriginalFetch?: typeof window.fetch;
  };
  const existing = target.__ficonterSmartInsightsFetchBoundary;
  if (existing) {
    existing.client = client;
    existing.vaultKey = vaultKey;
    existing.userId = userId;
    return;
  }

  const state: BoundaryState = { client, vaultKey, userId };
  target.__ficonterSmartInsightsFetchBoundary = state;
  const originalFetch = window.fetch.bind(window);
  target.__ficonterSmartInsightsOriginalFetch = originalFetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    let pathname = url;
    try {
      pathname = new URL(url, window.location.origin).pathname;
    } catch {
      pathname = url;
    }

    if (pathname !== "/api/wealth/ai-insights") {
      return originalFetch(input, init);
    }

    const method = requestMethod(input, init);

    if (method === "POST") {
      try {
        const rawBody = await requestBody(input, init);
        const parsed = rawBody ? JSON.parse(rawBody) as { inputs?: unknown } : null;
        if (!parsed?.inputs) {
          return jsonResponse({ error: "Smart insight inputs are required." }, 400);
        }

        const inputs = normalizeAiInsightsInputs(parsed.inputs);
        const context = calculateAiInsightsContext(inputs);
        if (!context.assessed || context.dataCoverage <= 0) {
          return jsonResponse(
            { error: "Add financial records before generating Smart Insights.", code: "not_enough_data" },
            409,
          );
        }

        const report = normalizeAiInsightReport(generateSmartInsightReport(context));
        if (!report) {
          return jsonResponse({ error: "Smart Insights could not prepare a valid report." }, 500);
        }

        const saved = await saveAiInsightSnapshotToVault(
          state.client,
          state.vaultKey,
          state.userId,
          context,
          report,
        );
        return jsonResponse({
          ok: true,
          cached: saved.cached,
          snapshot: saved.snapshot,
        });
      } catch (error) {
        return jsonResponse(
          {
            error:
              error instanceof Error
                ? error.message
                : "Smart Insights could not generate a report.",
          },
          500,
        );
      }
    }

    if (method === "DELETE") {
      try {
        await clearAiInsightSnapshots(state.client, state.userId);
        return jsonResponse({ ok: true });
      } catch (error) {
        return jsonResponse(
          {
            error:
              error instanceof Error
                ? error.message
                : "Smart Insight history could not be cleared.",
          },
          500,
        );
      }
    }

    return jsonResponse({ error: "Method not allowed." }, 405);
  };
}
