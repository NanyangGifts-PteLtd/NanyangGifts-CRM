"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Keep several messages visible together so a quick succession of
      // success/error notifications does not visually displace an earlier
      // message before its configured lifetime has elapsed.
      visibleToasts={6}
      // Sonner normally collapses a toast stack and hides the content of every
      // toast except the front one until the user hovers over it. That makes a
      // persistent action such as "Refresh now" or "Undo" unreachable on
      // touch devices and easy to miss whenever another notification arrives.
      // Actionable notifications must remain visible without a hover gesture.
      expand
      toastOptions={{
        // Keep routine success/error messages visible long enough to read the
        // server-provided detail, particularly for long-running integrations.
        duration: 12_000,
        classNames: {
          toast:
            "!w-[420px] !max-w-[calc(100vw-1rem)] !flex-wrap !items-start !gap-2 !px-5 !py-4 !text-sm !shadow-2xl",
          content: "!min-w-0 !flex-1",
          title: "!text-base !font-semibold",
          description: "!text-sm",
          actionButton:
            "!order-last !mt-2 !h-9 !w-full !basis-full !justify-center !whitespace-nowrap !px-3 !ml-0",
          cancelButton:
            "!order-last !mt-2 !h-9 !w-full !basis-full !justify-center !whitespace-nowrap !px-3 !ml-0",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
