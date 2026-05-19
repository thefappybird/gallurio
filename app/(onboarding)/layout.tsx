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
    <div className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
