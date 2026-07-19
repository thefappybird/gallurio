import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignInForm } from "./_sign-in-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return { title: t("signIn.title") };
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string; notice?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { returnTo, notice } = await searchParams;

  return <SignInForm returnTo={returnTo} sessionExpired={notice === "session_expired"} />;
}
