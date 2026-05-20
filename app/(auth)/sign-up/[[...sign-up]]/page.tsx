import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { clerkAppearance } from "@/lib/auth/clerkAppearance";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return <SignUp appearance={clerkAppearance} />;
}
