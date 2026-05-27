import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ClerkThemed } from "@/components/app/clerk-themed";
import { SELECTABLE_THEME_IDS } from "@/lib/theme/themes";

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
