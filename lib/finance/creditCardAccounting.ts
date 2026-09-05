import { finiteNumber, roundMoney, sumMoney } from "@/lib/finance/money";

export const CREDIT_CARD_MINIMUM_PAYMENT_RATE = 0.03;
export const CREDIT_CARD_MINIMUM_PAYMENT_DECIMALS = 2;

export type CreditCardStatementLike = {
  statement_balance: number | string;
  minimum_payment?: number | string | null;
  statement_date: string;
};

export type CreditCardPaymentLike = {
  debt_id: string;
  amount: number | string;
  paid_at: string;
};

/**
 * Credit-card minimum payments are monetary amounts and always use
 * FICONTER's standard two-decimal money rounding.
 * Examples: 45.678 -> 45.68, 45.674 -> 45.67, 45.675 -> 45.68.
 */
export function roundCreditCardMinimumPayment(value: unknown) {
  return roundMoney(value);
}

export function creditCardMinimumPayment(statementBalance: unknown) {
  const balance = Math.max(0, finiteNumber(statementBalance));
  return Math.min(
    balance,
    roundCreditCardMinimumPayment(
      balance * CREDIT_CARD_MINIMUM_PAYMENT_RATE,
    ),
  );
}

export function creditCardStatementRemaining(
  statementBalance: unknown,
  paymentsApplied: unknown,
) {
  return Math.max(
    0,
    roundMoney(
      finiteNumber(statementBalance) - finiteNumber(paymentsApplied),
    ),
  );
}

export function creditCardMinimumRemaining(
  statementBalance: unknown,
  paymentsApplied: unknown,
) {
  return Math.max(
    0,
    roundCreditCardMinimumPayment(
      creditCardMinimumPayment(statementBalance) -
        finiteNumber(paymentsApplied),
    ),
  );
}

export function paymentsAppliedToStatement<T extends CreditCardPaymentLike>(
  payments: T[],
  debtId: string,
  statementDate: string,
  nextStatementDate?: string | null,
  amountSelector: (payment: T) => number = (payment) =>
    finiteNumber(payment.amount),
) {
  const start = new Date(`${statementDate}T00:00:00`).getTime();
  const end = nextStatementDate
    ? new Date(`${nextStatementDate}T00:00:00`).getTime()
    : Number.POSITIVE_INFINITY;

  return sumMoney(
    payments
      .filter((payment) => {
        if (payment.debt_id !== debtId) return false;
        const paidAt = new Date(payment.paid_at).getTime();
        return paidAt >= start && paidAt < end;
      })
      .map(amountSelector),
  );
}
