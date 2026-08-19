import type { Subitem } from "@/app/types";

const CURRENCY_RATES: Record<string, number> = {
    RMB: 0.2,
    SGD: 1,
    MYR: 0.333,
};

function parseNumericValue(value: string | number | undefined | null) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (value == null || value === "") return 0;
    const parsed = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateSubitemFinancials(subitem: Subitem) {
    const quantity = parseNumericValue(subitem.qty);
    const cost = parseNumericValue(subitem.cost);
    const manpower = parseNumericValue(subitem.manpower);
    const localShipping = parseNumericValue(subitem.ls);
    const overseasShipping = parseNumericValue(subitem.os);
    const unitPrice = parseNumericValue(subitem.up);
    const currencyRate = CURRENCY_RATES[subitem.currency ?? "RMB"] ?? 0.2;
    const cSgd = cost * currencyRate;
    const tcSgd = cSgd * quantity;
    const tc = tcSgd + manpower + localShipping + overseasShipping;
    const price = unitPrice * quantity;
    const markup = price - tc;

    return {
        quantity,
        cSgd,
        tcSgd,
        tc,
        price,
        markup,
        percentMarkup: tc !== 0 ? markup / tc * 100 : null,
    };
}

export function parseSubitemNumber(value: string | number | undefined | null) {
    return parseNumericValue(value);
}
