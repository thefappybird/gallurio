import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { VerifyEmailForm } from "./_verify-email-form";
import { getEmailVerificationExpiresAt } from "../_actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return { title: t("verifyEmail.title") };
}

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const expiresAt = await getEmailVerificationExpiresAt();
  return <VerifyEmailForm locale={locale} expiresAt={expiresAt} />;
}
