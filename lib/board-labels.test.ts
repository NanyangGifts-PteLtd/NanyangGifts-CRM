import { describe, expect, it } from "vitest";
import {
  canonicalPaymentStatusOptions,
  findSystemOption,
} from "./board-labels";

describe("payment label normalization", () => {
  it("keeps one canonical MISMATCH option and removes legacy payment labels", () => {
    const options = canonicalPaymentStatusOptions("payment_status", [
      {
        id: "paid",
        systemKey: "payment_status_paid",
        value: "✅",
        color: "#0c0",
      },
      {
        id: "legacy-under",
        systemKey: "payment_status_underpaid",
        value: "Underpaid",
        color: "#f00",
      },
      { id: "manual-mismatch", value: "MISMATCH", color: "#f00" },
      {
        id: "legacy-over",
        systemKey: "payment_status_overpaid",
        value: "Overpaid",
        color: "#fa0",
      },
      { id: "duplicate-mismatch", value: "MISMATCH", color: "#f00" },
    ]);

    expect(options.map((option) => option.id)).toEqual([
      "paid",
      "manual-mismatch",
    ]);
  });

  it("removes the legacy partial label from the overall payment options", () => {
    const options = canonicalPaymentStatusOptions("overall_payment_status", [
      { id: "unpaid", value: "Unpaid", color: "#aaa" },
      {
        id: "partial",
        systemKey: "overall_payment_status_partially_paid",
        value: "Partially Paid",
        color: "#fa0",
      },
      { id: "mismatch", value: "MISMATCH", color: "#f00" },
      { id: "paid", value: "Fully Paid", color: "#0c0" },
    ]);

    expect(options.map((option) => option.value)).toEqual([
      "Unpaid",
      "MISMATCH",
      "Fully Paid",
    ]);
  });

  it("uses a manually configured MISMATCH option when no system key exists", () => {
    expect(
      findSystemOption(
        [{ id: "manual", value: "MISMATCH", color: "#f00" }],
        "payment_status_mismatch",
        "MISMATCH",
      ),
    ).toMatchObject({ id: "manual", value: "MISMATCH" });
  });
});
