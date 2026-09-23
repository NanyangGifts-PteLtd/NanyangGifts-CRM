export type OptionEntry = {
  id?: string;
  systemKey?: string | null;
  value: string;
  color: string;
  section?: number;
};

export const PAYMENT_STATUS_SYSTEM_KEYS = new Set([
  "payment_status_paid",
  "payment_status_mismatch",
  "payment_status_resolved",
]);

export const DEFAULT_PAYMENT_STATUS_OPTIONS: OptionEntry[] = [
  { value: "✅", color: "#22c55e" },
  { value: "MISMATCH", color: "#ef4444" },
  { value: "Resolved", color: "#3b82f6" },
];

export const AUTOMATED_OPTION_LABELS: Record<string, Set<string>> = {
  payment_status: new Set(["✅", "MISMATCH", "Resolved"]),
  overall_payment_status: new Set(["Unpaid", "MISMATCH", "Fully Paid"]),
};

const LEGACY_MISMATCH_VALUES = new Set([
  "Underpaid",
  "Overpaid",
  "Partial",
  "Partially Paid",
]);

const legacySystemKeysFor = (code: PaymentStatusGroup) =>
  new Set(
    code === "payment_status"
      ? ["payment_status_underpaid", "payment_status_overpaid"]
      : ["overall_payment_status_partially_paid"],
  );

export type PaymentStatusGroup = "payment_status" | "overall_payment_status";

export function canonicalPaymentStatusOptions(
  code: PaymentStatusGroup,
  options: OptionEntry[],
) {
  const mismatchSystemKey =
    code === "payment_status"
      ? "payment_status_mismatch"
      : "overall_payment_status_mismatch";
  const canonicalMismatch = options.find(
    (option) => option.systemKey === mismatchSystemKey,
  );
  const legacySystemKeys = legacySystemKeysFor(code);

  return options.filter(
    (option) =>
      !legacySystemKeys.has(option.systemKey ?? "") &&
      !LEGACY_MISMATCH_VALUES.has(option.value) &&
      (option.systemKey !== mismatchSystemKey ||
        option.id === canonicalMismatch?.id),
  );
}

export function findSystemOption(
  options: OptionEntry[],
  systemKey: string,
  fallback: string,
): OptionEntry {
  return (
    options.find((option) => option.systemKey === systemKey) ??
    { value: fallback, color: "#d1d5db" }
  );
}
