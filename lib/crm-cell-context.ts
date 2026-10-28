export type CrmRowActionsEventDetail = {
  id: string;
  clientX?: number;
  clientY?: number;
  cellText?: string;
};

const normalizeCellText = (value: string) =>
  value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export function crmCellText(
  eventTarget: EventTarget | null,
  cellSelector: string,
) {
  if (!(eventTarget instanceof HTMLElement)) return "";
  const cell = eventTarget.closest<HTMLElement>(cellSelector);
  if (!cell) return "";

  const explicitValue =
    eventTarget.closest<HTMLElement>("[data-crm-cell-value]") ??
    cell.querySelector<HTMLElement>("[data-crm-cell-value]");
  if (explicitValue?.dataset.crmCellValue !== undefined) {
    return explicitValue.dataset.crmCellValue;
  }

  const control =
    eventTarget.closest<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select",
    ) ??
    cell.querySelector<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input:not([type=checkbox]):not([type=radio]), textarea, select");
  if (control) return control.value;

  const copy = cell.cloneNode(true) as HTMLElement;
  copy
    .querySelectorAll(
      "[data-client-action-menu], [data-subitem-action-menu], [data-selection-control]",
    )
    .forEach((element) => element.remove());
  return normalizeCellText(copy.innerText || copy.textContent || "");
}

export async function copyCrmCellText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Safari and restricted browser contexts may expose the API but reject
      // the write. Fall through to the selection-based compatibility path.
    }
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Clipboard write was rejected");
}
