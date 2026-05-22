import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session.userId) redirect("/sign-in");

  return (
    <div className="flex flex-1 flex-col bg-muted/30">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 md:py-16">
        {children}
      </div>
    </div>
  );
}
