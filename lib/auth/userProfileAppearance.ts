import type { ComponentProps } from "react";
import type { UserProfile } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

type Appearance = NonNullable<ComponentProps<typeof UserProfile>["appearance"]>;

export function buildUserProfileAppearance({
  scheme,
}: {
  scheme: "light" | "dark";
}): Appearance {
  return {
    baseTheme: scheme === "dark" ? dark : undefined,
    variables: {
      borderRadius: "0px",
      fontFamily: "var(--font-sans)",
      colorBackground: "var(--background)",
      colorForeground: "var(--foreground)",
      colorPrimary: "var(--primary)",
      colorDanger: "var(--destructive)",
      colorInput: "var(--input)",
      colorInputForeground: "var(--foreground)",
      colorBorder: "var(--border)",
      colorMuted: "var(--muted)",
      colorNeutral: "var(--muted-foreground)",
      colorRing: "var(--ring)",
    },
    elements: {
      // width! / max-w-none! use the Tailwind v4 important modifier (trailing !)
      // which generates `width: 100% !important` / `max-width: none !important`.
      // Clerk injects its own unlayered stylesheet at runtime that sets a fixed
      // max-width on .cl-cardBox / .cl-rootBox; our Tailwind class strings in
      // appearance.elements have identical specificity and can lose on source
      // order. The !important modifier is the only reliable way to win without
      // resorting to global CSS overrides.
      rootBox: "w-full! max-w-none!",
      cardBox: "w-full! max-w-none! border border-border bg-card rounded-none shadow-none",
      card: "w-full! max-w-none! rounded-none border-none shadow-none bg-card text-card-foreground",
      navbar: "bg-card border-r border-border rounded-none",
      navbarButton:
        "rounded-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
      navbarButton__active: "bg-accent text-accent-foreground",
      scrollBox: "w-full! bg-background",
      pageScrollBox: "w-full! bg-background",
      formButtonPrimary:
        "rounded-none bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:bg-primary/90",
      formFieldInput: "rounded-none border-input bg-background text-foreground",
      formFieldLabel: "text-foreground",
      badge: "rounded-none",
      avatarBox: "rounded-none",
      dividerLine: "bg-border",
    },
  };
}
