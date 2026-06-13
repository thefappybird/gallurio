import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MfaForm } from "./_mfa-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return { title: t("mfa.title") };
}

export default async function MfaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MfaForm />;
}
