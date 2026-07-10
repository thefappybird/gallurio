import Image from "next/image";
import Link from "next/link";
import { AmbientBackground } from "@/components/app/ambient-background";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-1 items-center justify-center bg-onboarding-bg px-4 py-12">
      <AmbientBackground />
      <div className="relative flex w-full flex-col items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center">
          <Image src="/brand/gallurio-sq.svg" alt="" width={28} height={28} className="h-7 w-7" priority />
          <span className="font-heading text-base font-semibold tracking-tight">Gallurio</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
