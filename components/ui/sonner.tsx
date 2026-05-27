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
          toast: "border bg-popover text-popover-foreground shadow-lg !rounded-none animate-toast-in",
          title: "text-sm font-semibold",
          description: "text-xs opacity-90",
          actionButton: "!rounded-none !bg-primary !text-primary-foreground",
          cancelButton: "!rounded-none !bg-muted !text-muted-foreground",
          closeButton: "!rounded-none border border-border bg-background hover:bg-muted",
        },
      }}
      {...props}
    />
  );
}
