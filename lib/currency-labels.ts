export type CurrencyOption = { id?: string; systemKey?: string | null };

export function currencySystemKey(
  optionId: string | null | undefined,
  options: CurrencyOption[],
) {
  return options.find((option) => option.id === optionId)?.systemKey ?? null;
}

export function currencyToSgdRate(systemKey: string | null | undefined) {
  switch (systemKey) {
    case "currency_rmb": return 0.2;
    case "currency_myr": return 0.333;
    case "currency_sgd": return 1;
    default: return 0;
  }
}

export function sgdToCurrencyMultiplier(systemKey: string | null | undefined) {
  switch (systemKey) {
    case "currency_rmb": return 5;
    case "currency_myr": return 3;
    case "currency_sgd": return 1;
    default: return 0;
  }
}
