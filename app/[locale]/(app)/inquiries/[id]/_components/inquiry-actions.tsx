"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useInvalidateFor } from "@/hooks/use-data-events";
import { Button } from "@/components/ui/button";
import { archiveInquiryAction, declineInquiryAction } from "../../_actions";
import { isBookedInquiryStatus } from "@/lib/inquiries/status";

type Props = {
  inquiryId: string;
  status: string;
  /** The inquiry's draft booking / client, when known; only used to match the server's socket echo. */
  bookingId?: string | null;
  clientId?: string | null;
};

type WorkingAction = "decline" | "archive" | null;

export function InquiryActions({ inquiryId, status, bookingId = null, clientId = null }: Props) {
  const t = useTranslations("app.inquiries.detail.actions");
  const invalidateFor = useInvalidateFor();
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
      // decline/archive actions revalidate the inquiry routes.
      // Same key sets the server emits, so the socket echo is suppressed.
      invalidateFor({ type: "inquiry.updated", inquiryId, bookingId }, { refresh: false });
      if (bookingId) {
        invalidateFor({ type: "booking.updated", bookingId, clientId, inquiryId }, { refresh: false });
      }
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
