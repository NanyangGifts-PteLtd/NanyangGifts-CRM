"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const UPDATE_TOAST_ID = "deployment-update-available";

type DeploymentUpdateNotifierProps = {
  /** The deployment identifier embedded in the version of the app this tab loaded. */
  currentVersion: string;
};

/**
 * Keeps an already-open application tab aware of newer Vercel deployments.
 * It deliberately asks the user to refresh instead of reloading automatically:
 * CRM edits can be in progress outside a form's saved state.
 */
export function DeploymentUpdateNotifier({
  currentVersion,
}: DeploymentUpdateNotifierProps) {
  const updateAvailable = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (updateAvailable.current || currentVersion === "development") return;

    try {
      const response = await fetch("/api/app-version", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!response.ok) return;

      const payload = (await response.json()) as { version?: string };
      if (!payload.version || payload.version === currentVersion) return;

      updateAvailable.current = true;
      toast.info("A new version of the app is available", {
        id: UPDATE_TOAST_ID,
        description: "Refresh when you are ready to use the latest changes.",
        duration: Infinity,
        action: {
          label: "Refresh now",
          onClick: () => window.location.reload(),
        },
      });
    } catch {
      // Version checks are intentionally silent: temporary connectivity issues
      // must not interrupt the user or create an error toast.
    }
  }, [currentVersion]);

  useEffect(() => {
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };

    const interval = window.setInterval(() => void checkForUpdate(), VERSION_CHECK_INTERVAL_MS);
    window.addEventListener("focus", checkWhenVisible);
    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkWhenVisible);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [checkForUpdate]);

  return null;
}
