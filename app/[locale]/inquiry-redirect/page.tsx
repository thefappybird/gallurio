import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth/requireOrg";
import { isWorkspaceGated } from "@/lib/billing/access";
import { buildInquiryModalPath } from "@/lib/inquiries/links";

export default async function InquiryRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ inquiryId?: string }>;
}) {
  const { inquiryId } = await searchParams;
  if (!inquiryId) redirect("/inquiries");

  const { workspace } = await requireOrg({ allowWhenGated: true });
  const destination = buildInquiryModalPath(inquiryId);

  if (isWorkspaceGated(workspace)) {
    redirect(`/subscribe?returnTo=${encodeURIComponent(destination)}`);
  }
  redirect(destination);
}
