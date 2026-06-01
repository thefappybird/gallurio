import { auth } from "@clerk/nextjs/server";
import { SignOutButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LogOutIcon } from "lucide-react";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session.userId) redirect("/sign-in");

  const t = await getTranslations("app.sidebar");

  return (
    <div className="flex flex-1 flex-col bg-muted/30">
      {/* Lowkey escape hatch — lets a signed-in user leave the onboarding flow
          without completing it. Sits outside the step content. */}
      <div className="flex justify-end px-4 pt-4">
        <SignOutButton redirectUrl="/sign-in">
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
          >
            <LogOutIcon className="size-3.5 shrink-0" aria-hidden />
            {t("logOut")}
          </button>
        </SignOutButton>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10 pt-4 md:pb-16">
        {children}
      </div>
    </div>
  );
}
