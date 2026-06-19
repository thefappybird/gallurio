"use client";

import { useTheme } from "next-themes";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";
import { resolveScheme } from "@/lib/theme/themes";

export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return (
    <SonnerToaster
      theme={resolveScheme(resolvedTheme)}
      position="bottom-right"
      duration={4000}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          // Toasts are controls — soften with the control radius (--radius), not
          // the sharp frame radius. `!` defeats sonner's own injected styles.
          toast: "border bg-popover text-popover-foreground shadow-lg !rounded-[var(--radius)] animate-toast-in",
          title: "text-sm font-semibold",
          description: "text-xs opacity-90",
          actionButton: "!rounded-[var(--radius)] !bg-primary !text-primary-foreground",
          cancelButton: "!rounded-[var(--radius)] !bg-muted !text-muted-foreground",
          closeButton: "!rounded-[var(--radius)] border border-border bg-background hover:bg-muted",
        },
      }}
      {...props}
    />
  );
}
