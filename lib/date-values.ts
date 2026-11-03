// HTML date inputs represent an unset value as an empty string, while the
// database represents it as NULL.
export const toNullableDateValue = (value: string) =>
  value.trim() === "" ? null : value;
