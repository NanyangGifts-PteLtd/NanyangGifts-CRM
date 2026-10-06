export type CurrencyOption = {
  id?: string;
  systemKey?: string | null;
  value?: string;
};

export function currencySystemKey(
  optionId: string | null | undefined,
  options: CurrencyOption[],
  legacyValue?: string | null,
) {
  const byId = options.find((option) => option.id === optionId);
  if (byId) return byId.systemKey ?? null;

  // Older rows (including Payment Vouchers created before the ID was saved)
  // may only contain the rendered label text. Use it strictly as a read
  // fallback; new writes always store the stable option ID.
  const normalizedLegacyValue = legacyValue?.trim().toLocaleLowerCase();
  return (
    options.find(
      (option) =>
        !optionId &&
        Boolean(normalizedLegacyValue) &&
        option.value?.trim().toLocaleLowerCase() === normalizedLegacyValue,
    )?.systemKey ?? null
  );
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
