"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { clerkAppearance } from "@/lib/auth/clerkAppearance";
import { resolveScheme } from "@/lib/theme/themes";

export function ClerkThemed({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolveScheme(resolvedTheme) === "dark";
  return (
    <ClerkProvider
      appearance={{
        ...clerkAppearance,
        baseTheme: isDark ? dark : undefined,
      }}
    >
      {children}
    </ClerkProvider>
  );
}
