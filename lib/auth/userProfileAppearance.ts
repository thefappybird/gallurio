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
      rootBox: "w-full",
      cardBox: "w-full max-w-full border border-border bg-card rounded-none shadow-none",
      card: "rounded-none border-none shadow-none bg-card text-card-foreground",
      navbar: "bg-card border-r border-border rounded-none",
      navbarButton:
        "rounded-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
      navbarButton__active: "bg-accent text-accent-foreground",
      scrollBox: "bg-background",
      pageScrollBox: "bg-background",
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
