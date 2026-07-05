import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LogOutIcon } from "lucide-react";
import { getAuthUser } from "@/lib/auth/session";
import { SignOutLink } from "@/components/app/sign-out-link";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { LocaleSwitcher } from "@/components/app/locale-switcher";
import { OnboardingCornerAccents } from "./onboarding/_components/decorative-accents";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authUser = await getAuthUser();
  if (!authUser) redirect("/sign-in");

  const t = await getTranslations("app.sidebar");

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-onboarding-bg">
      <OnboardingCornerAccents />
      {/* Header row: theme/locale controls opposite the escape hatch — lets a
          signed-in user adjust their environment or leave the onboarding flow
          without completing it. Sits outside the step content. */}
      <div className="relative flex shrink-0 items-center justify-between px-4 pt-4 sm:px-6">
        <div className="flex items-center gap-1">
          <ThemeToggle variant="standalone" />
          <LocaleSwitcher variant="standalone" />
        </div>
        <SignOutLink>
          <LogOutIcon className="size-3.5 shrink-0" aria-hidden />
          {t("logOut")}
        </SignOutLink>
      </div>
      <div className="relative mx-auto flex w-full min-h-0 max-w-6xl flex-1 flex-col px-4 pb-4 pt-2 md:pb-6">
        {children}
      </div>
    </div>
  );
}
