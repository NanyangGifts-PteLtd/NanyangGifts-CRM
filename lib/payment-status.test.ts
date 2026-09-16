import { describe, expect, it } from "vitest";
import { automaticPaymentStatus, overallPaymentStatus } from "./payment-status";

const paymentOptions = [
  { systemKey: "payment_status_paid", value: "PAID", color: "#0c0" },
  { systemKey: "payment_status_mismatch", value: "MISMATCH", color: "#f00" },
];
const overallOptions = [
  {
    systemKey: "overall_payment_status_unpaid",
    value: "Unpaid",
    color: "#aaa",
  },
  {
    systemKey: "overall_payment_status_mismatch",
    value: "MISMATCH",
    color: "#f00",
  },
  {
    systemKey: "overall_payment_status_fully_paid",
    value: "Fully Paid",
    color: "#0c0",
  },
];

describe("payment status calculations", () => {
  it.each([-0.004, 0, 0.004])("treats %s as an exact payment", (difference) => {
    expect(automaticPaymentStatus(difference, paymentOptions)).toBe("PAID");
  });

  it.each([-1, 1])("maps %s payment differences to MISMATCH", (difference) => {
    expect(automaticPaymentStatus(difference, paymentOptions)).toBe("MISMATCH");
  });

  it("returns the expected overall payment state", () => {
    expect(overallPaymentStatus(0, 0, overallOptions)).toBe("");
    expect(overallPaymentStatus(3, 0, overallOptions)).toBe("Unpaid");
    expect(overallPaymentStatus(3, 2, overallOptions)).toBe("MISMATCH");
    expect(overallPaymentStatus(3, 3, overallOptions)).toBe("Fully Paid");
  });
});
