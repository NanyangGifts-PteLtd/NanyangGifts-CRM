import type { Subitem } from "@/app/types";
import { currencySystemKey, currencyToSgdRate, type CurrencyOption } from "@/lib/currency-labels";

function parseNumericValue(value: string | number | undefined | null) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (value == null || value === "") return 0;
    const parsed = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Unit prices may be quoted to three decimal places. This is deliberately
 * separate from line totals, which remain commercial two-decimal amounts.
 */
export function roundUnitPrice(value: number) {
    return Math.round((value + Number.EPSILON) * 1_000) / 1_000;
}

/** A persisted line total is always stored and displayed to two decimals. */
export function roundMonetaryAmount(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateSubitemFinancials(subitem: Subitem, currencyOptions: CurrencyOption[] = []) {
    const quantity = parseNumericValue(subitem.qty);
    const cost = parseNumericValue(subitem.cost);
    const manpower = parseNumericValue(subitem.manpower);
    const localShipping = parseNumericValue(subitem.ls);
    const overseasShipping = parseNumericValue(subitem.os);
    const unitPrice = roundUnitPrice(parseNumericValue(subitem.up));
    // A missing currency must never silently be treated as RMB.
    const currencyRate = currencyToSgdRate(
        currencySystemKey(
            subitem.currencyOptionId,
            currencyOptions,
            subitem.currency,
        ),
    );
    const cSgd = cost * currencyRate;
    const tcSgd = cSgd * quantity;
    const tc = tcSgd + manpower + localShipping + overseasShipping;
    // Do not round U.P. down to cents before multiplication: the full
    // three-decimal U.P is used, then the resulting line total is rounded to
    // the CRM's two-decimal monetary precision.
    const price = roundMonetaryAmount(unitPrice * quantity);
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
