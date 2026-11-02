/**
 * The deliberately small set of subitem fields that may be carried to a
 * duplicate. Keep this allow-list rather than a deny-list: new workflow,
 * tracking, payment, sample, or attachment fields must start empty unless
 * they are explicitly approved here.
 */
export const DUPLICATED_SUBITEM_FIELD_KEYS = [
  "name",
  "qty",
  "description",
  "remarks",
  "supplier",
  // Commercial / pricing fields.
  "cost",
  "manpower",
  "manpower_rmb",
  "ls",
  "os",
  "currency",
  "currency_option_id",
  "c_sgd",
  "tc",
  "uc",
  "tc_sgd",
  "price",
  "up",
  "total_uc",
  "ls_rmb",
  "total_c",
] as const;

/** Build the persisted values for a fresh duplicate of a subitem. */
export function duplicateSubitemValues(source: Record<string, unknown>) {
  const copy: Record<string, unknown> = {};
  for (const key of DUPLICATED_SUBITEM_FIELD_KEYS) {
    if (key in source) copy[key] = source[key];
  }
  return copy;
}
