const CURRENCY_MINOR_UNITS: Record<string, number> = {
  TRY: 100,
  USD: 100,
  EUR: 100,
};

const MIN_DAILY_BUDGET_TRY = 2000; // 20.00 TRY in minor units (Meta minimum varies)

export function convertBudgetToMetaAmount(input: {
  amount: number;
  currency?: string;
}): number {
  const currency = (input.currency ?? "TRY").toUpperCase();
  const factor = CURRENCY_MINOR_UNITS[currency] ?? 100;
  return Math.round(input.amount * factor);
}

export function validateDailyBudget(input: {
  amount: number;
  currency?: string;
}): { valid: boolean; metaAmount: number; message?: string } {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { valid: false, metaAmount: 0, message: "Günlük bütçe pozitif olmalı" };
  }

  const metaAmount = convertBudgetToMetaAmount(input);
  const currency = (input.currency ?? "TRY").toUpperCase();

  if (currency === "TRY" && metaAmount < MIN_DAILY_BUDGET_TRY) {
    return {
      valid: false,
      metaAmount,
      message: `Günlük bütçe en az ${MIN_DAILY_BUDGET_TRY / 100} TL olmalı (Meta minimum)`,
    };
  }

  return { valid: true, metaAmount };
}
