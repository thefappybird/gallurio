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
      toastOptions={{
        classNames: {
          toast:
            "border border-border bg-popover text-popover-foreground shadow-md !rounded-none",
          title: "text-sm font-medium",
          description: "text-xs text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
