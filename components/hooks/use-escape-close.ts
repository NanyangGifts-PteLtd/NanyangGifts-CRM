"use client";

import { useEffect } from "react";
import { useAppConfirmation } from "@/components/ui/confirmation-provider";

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
  const confirm = useAppConfirmation();
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = async (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      if (disabled) return;
      if (
        isDirty &&
        !(await confirm({
          title: "Discard unsaved changes?",
          description: discardMessage,
          confirmLabel: "Discard",
          destructive: true,
        }))
      )
        return;
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [confirm, disabled, discardMessage, isDirty, onClose, open]);
}
