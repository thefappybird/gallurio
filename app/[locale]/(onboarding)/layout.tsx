import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LogOutIcon } from "lucide-react";
import { getAuthUser } from "@/lib/auth/session";
import { SignOutLink } from "@/components/app/sign-out-link";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authUser = await getAuthUser();
  if (!authUser) redirect("/sign-in");

  const t = await getTranslations("app.sidebar");

  return (
    <div className="flex flex-1 flex-col bg-muted/30">
      {/* Lowkey escape hatch — lets a signed-in user leave the onboarding flow
          without completing it. Sits outside the step content. */}
      <div className="flex justify-end px-4 pt-4">
        <SignOutLink>
          <LogOutIcon className="size-3.5 shrink-0" aria-hidden />
          {t("logOut")}
        </SignOutLink>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10 pt-4 md:pb-16">
        {children}
      </div>
    </div>
  );
}
