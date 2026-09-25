import type { Subitem } from "@/app/types";
import { currencySystemKey, currencyToSgdRate, type CurrencyOption } from "@/lib/currency-labels";

function parseNumericValue(value: string | number | undefined | null) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (value == null || value === "") return 0;
    const parsed = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateSubitemFinancials(subitem: Subitem, currencyOptions: CurrencyOption[] = []) {
    const quantity = parseNumericValue(subitem.qty);
    const cost = parseNumericValue(subitem.cost);
    const manpower = parseNumericValue(subitem.manpower);
    const localShipping = parseNumericValue(subitem.ls);
    const overseasShipping = parseNumericValue(subitem.os);
    const unitPrice = parseNumericValue(subitem.up);
    // A missing currency must never silently be treated as RMB.
    const currencyRate = currencyToSgdRate(currencySystemKey(subitem.currencyOptionId, currencyOptions));
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
