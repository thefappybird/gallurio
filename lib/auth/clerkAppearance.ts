// Sign-in / sign-up appearance used by the Clerk auth pages.
// For the embedded <UserProfile /> in /settings, see userProfileAppearance.ts.
import type { ComponentProps } from "react";
import type { SignIn } from "@clerk/nextjs";

type Appearance = ComponentProps<typeof SignIn>["appearance"];

export const clerkAppearance: Appearance = {
  variables: {
    borderRadius: "0px",
    fontFamily: "var(--font-sans)",
    colorPrimary: "oklch(0.205 0 0)",
    colorBackground: "oklch(1 0 0)",
    colorInputBackground: "oklch(1 0 0)",
    colorInputText: "oklch(0.145 0 0)",
    colorText: "oklch(0.145 0 0)",
    colorTextSecondary: "oklch(0.556 0 0)",
    colorDanger: "oklch(0.577 0.245 27.325)",
  },
  elements: {
    card: "border border-border shadow-none rounded-none",
    formButtonPrimary: "rounded-none",
    formFieldInput: "rounded-none",
    socialButtonsBlockButton: "rounded-none",
    organizationSwitcherTrigger: "rounded-none",
    userButtonAvatarBox: "rounded-none",
    avatarBox: "rounded-none",
    badge: "rounded-none",
  },
};
