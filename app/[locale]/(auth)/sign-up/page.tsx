import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignUpForm } from "./_sign-up-form";
import { z } from "zod";

const lockedEmailSchema = z.string().trim().toLowerCase().email();

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return { title: t("signUp.title") };
}

export default async function SignUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { locale } = await params;
  const { email } = await searchParams;
  setRequestLocale(locale);
  const lockedEmail = lockedEmailSchema.safeParse(email);
  return <SignUpForm lockedEmail={lockedEmail.success ? lockedEmail.data : null} />;
}
