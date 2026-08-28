import type { CurrencySourceData } from "@/lib/finance/baseCurrencyReconciliation";
import {
  buildFinancialIndependenceClientInputs,
  type FinancialIndependenceClientPayload,
} from "@/lib/e2ee/financialIndependenceClientInputs";
import {
  decryptFinancialIndependenceSettingsPayload,
  encryptFinancialIndependenceSettingsPayload,
  type FinancialIndependenceSettingsPrivatePayloadV1,
} from "@/lib/e2ee/financialIndependenceSettingsPayload";

type BoundaryState = {
  vaultKey: CryptoKey;
  userId: string;
  getSource: () => CurrencySourceData;
  settingsLoaded: boolean;
  settings: FinancialIndependenceClientPayload["settings"];
  revision: number;
  updatedAt: string | null;
};

function finite(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function installFinancialIndependenceE2eeBoundary(
  client: any,
  vaultKey: CryptoKey,
  userId: string,
  getSource: () => CurrencySourceData,
) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterFinancialIndependenceBoundaryState as BoundaryState | undefined;
  if (existing) {
    existing.vaultKey = vaultKey;
    existing.userId = userId;
    existing.getSource = getSource;
    return;
  }

  const state: BoundaryState = {
    vaultKey,
    userId,
    getSource,
    settingsLoaded: false,
    settings: undefined,
    revision: -1,
    updatedAt: null,
  };
  rawClient.__ficonterFinancialIndependenceBoundaryState = state;

  const originalRpc = rawClient.rpc.bind(rawClient);
  const originalFrom = rawClient.from.bind(rawClient);

  async function ensureSettings() {
    if (state.settingsLoaded) return;

    const result = await originalFrom("financial_independence_settings")
      .select("*")
      .eq("user_id", state.userId)
      .maybeSingle();
    if (result.error) throw result.error;

    const row = result.data;
    if (!row) {
      state.settingsLoaded = true;
      state.settings = undefined;
      state.revision = -1;
      state.updatedAt = null;
      return;
    }

    if (row.encryption_version === 1 && row.encrypted_payload) {
      const opened = await decryptFinancialIndependenceSettingsPayload(
        state.vaultKey,
        state.userId,
        row,
      );
      state.settings = {
        targetMonthlySpending: opened.target_monthly_spending,
        withdrawalRate: opened.withdrawal_rate,
        annualRealReturnRate: opened.annual_real_return_rate,
        updatedAt: row.updated_at ?? null,
      };
    } else {
      state.settings = {
        targetMonthlySpending: row.target_monthly_spending,
        withdrawalRate: row.withdrawal_rate,
        annualRealReturnRate: row.annual_real_return_rate,
        updatedAt: row.updated_at ?? null,
      };
    }

    state.revision = finite(row.e2ee_revision, 0);
    state.updatedAt = row.updated_at ?? null;
    state.settingsLoaded = true;
  }

  async function currentPayload() {
    await ensureSettings();
    return buildFinancialIndependenceClientInputs(state.getSource(), state.settings);
  }

  rawClient.rpc = (
    fn: string,
    args?: Record<string, unknown>,
    options?: unknown,
  ) => {
    if (fn === "get_financial_independence_inputs") {
      return currentPayload()
        .then((data) => ({ data, error: null }))
        .catch((error) => ({ data: null, error }));
    }
    return originalRpc(fn, args, options);
  };

  rawClient.from = (relation: string) => {
    const builder = originalFrom(relation);
    if (relation !== "financial_independence_settings") return builder;

    return new Proxy(builder, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property !== "upsert" || typeof value !== "function") {
          return typeof value === "function" ? value.bind(target) : value;
        }

        return async (input: unknown) => {
          try {
            if (!input || typeof input !== "object" || Array.isArray(input)) {
              return { data: null, error: new Error("Invalid Financial Independence settings payload.") };
            }

            await ensureSettings();
            const record = input as Record<string, unknown>;
            const privatePayload: FinancialIndependenceSettingsPrivatePayloadV1 = {
              target_monthly_spending: finite(record.target_monthly_spending),
              withdrawal_rate: finite(record.withdrawal_rate),
              annual_real_return_rate: finite(record.annual_real_return_rate),
            };
            const cipher = await encryptFinancialIndependenceSettingsPayload(
              state.vaultKey,
              state.userId,
              privatePayload,
            );
            const result = await originalRpc(
              "save_financial_independence_settings_e2ee_atomic",
              {
                p_expected_revision: state.revision,
                p_encrypted_payload: cipher,
              },
            );
            if (result.error) return result;

            const row = result.data;
            state.revision = finite(row?.e2ee_revision, state.revision + 1);
            state.updatedAt = row?.updated_at ?? new Date().toISOString();
            state.settings = {
              targetMonthlySpending: privatePayload.target_monthly_spending,
              withdrawalRate: privatePayload.withdrawal_rate,
              annualRealReturnRate: privatePayload.annual_real_return_rate,
              updatedAt: state.updatedAt,
            };
            state.settingsLoaded = true;

            return {
              data: row
                ? {
                    ...row,
                    target_monthly_spending: privatePayload.target_monthly_spending,
                    withdrawal_rate: privatePayload.withdrawal_rate,
                    annual_real_return_rate: privatePayload.annual_real_return_rate,
                  }
                : null,
              error: null,
            };
          } catch (error) {
            return { data: null, error };
          }
        };
      },
    });
  };
}
