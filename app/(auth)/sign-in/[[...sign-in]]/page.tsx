import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { clerkAppearance } from "@/lib/auth/clerkAppearance";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return <SignIn appearance={clerkAppearance} />;
}
