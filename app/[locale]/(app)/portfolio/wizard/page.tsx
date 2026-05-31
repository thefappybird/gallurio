import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "@/lib/i18n/navigation";
import { requireOrg } from "@/lib/auth/requireOrg";
import {
  PORTFOLIO_TEMPLATES,
  getTemplateForBusinessType,
} from "@/lib/page-builder/templates";
import { WizardClient, type WizardTemplateSummary } from "./_components/WizardClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.pageBuilder.wizard");
  return { title: t("title") };
}

export default async function WizardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { workspace, role } = await requireOrg();
  if (role !== "owner") {
    redirect({ href: "/portfolio", locale });
  }

  const templates: WizardTemplateSummary[] = PORTFOLIO_TEMPLATES.map((tpl) => ({
    id: tpl.id,
    label: tpl.label,
    description: tpl.description,
    previewImage: tpl.previewImage,
    defaultBrandKit: tpl.defaultBrandKit,
    defaultContact: tpl.defaultContact,
  }));

  const defaultTemplateId = getTemplateForBusinessType(workspace.businessType).id;

  return (
    <WizardClient
      templates={templates}
      defaultTemplateId={defaultTemplateId}
      workspaceBranding={{
        primaryColor: workspace.branding?.primaryColor ?? "#111111",
        secondaryColor: workspace.branding?.secondaryColor ?? "#f5f5f5",
        tagline: workspace.branding?.tagline ?? "",
        description: workspace.branding?.description ?? "",
      }}
      hasExistingData={Boolean(workspace.publicPage?.data?.home)}
    />
  );
}
