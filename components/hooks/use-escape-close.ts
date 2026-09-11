"use client";

import { useEffect } from "react";

type EscapeCloseOptions = {
  open: boolean;
  onClose: () => void;
  isDirty?: boolean;
  disabled?: boolean;
  discardMessage?: string;
};

export function useEscapeClose({
  open,
  onClose,
  isDirty = false,
  disabled = false,
  discardMessage = "Discard your unsaved changes and close this window?",
}: EscapeCloseOptions) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      if (disabled) return;
      if (isDirty && !window.confirm(discardMessage)) return;
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [disabled, discardMessage, isDirty, onClose, open]);
}
