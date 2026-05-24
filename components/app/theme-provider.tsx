"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { clerkAppearance } from "@/lib/auth/clerkAppearance";
import { SELECTABLE_THEME_IDS, resolveScheme } from "@/lib/theme/themes";

function ClerkThemed({ children }: { children: React.ReactNode }) {
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      themes={SELECTABLE_THEME_IDS}
    >
      <ClerkThemed>{children}</ClerkThemed>
    </NextThemesProvider>
  );
}
