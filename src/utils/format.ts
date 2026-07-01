const CURRENCY_LOCALE = "tr-TR";
const CURRENCY_CODE = "TRY";

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency: CURRENCY_CODE,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${formatNumber(value, decimals)}%`;
}

export function formatRoas(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${formatNumber(value, 2)}x`;
}

export function centsToCurrency(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return parsed / 100;
}
