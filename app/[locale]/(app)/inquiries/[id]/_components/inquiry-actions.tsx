"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { archiveInquiryAction, declineInquiryAction } from "../../_actions";
import { isBookedInquiryStatus } from "@/lib/inquiries/status";

type Props = {
  inquiryId: string;
  status: string;
};

type WorkingAction = "decline" | "archive" | null;

export function InquiryActions({ inquiryId, status }: Props) {
  const t = useTranslations("app.inquiries.detail.actions");
  const router = useRouter();
  const [workingAction, setWorkingAction] = useState<WorkingAction>(null);

  const canArchive = !isBookedInquiryStatus(status) && status !== "archived";

  if (!canArchive) return null;

  async function run(
    kind: "decline" | "archive",
    action: () => Promise<{ ok: true } | { error: string }>,
    successMsg: string
  ) {
    setWorkingAction(kind);
    try {
      const res = await action();
      if ("error" in res) {
        toast.error(t("errorToast"));
        return;
      }
      toast.success(successMsg);
      router.refresh();
    } catch {
      toast.error(t("errorToast"));
    } finally {
      setWorkingAction(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canArchive && (
        <Button
          variant="ghost"
          size="sm"
          loading={workingAction === "decline"}
          disabled={workingAction !== null}
          onClick={() => run("decline", () => declineInquiryAction(inquiryId), t("declinedToast"))}
        >
          {t("decline")}
        </Button>
      )}
      {canArchive && (
        <Button
          variant="ghost"
          size="sm"
          loading={workingAction === "archive"}
          disabled={workingAction !== null}
          onClick={() => run("archive", () => archiveInquiryAction(inquiryId), t("archivedToast"))}
        >
          {t("archive")}
        </Button>
      )}
    </div>
  );
}
