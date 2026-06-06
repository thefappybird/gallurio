"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { markContactedAction, archiveInquiryAction } from "../../_actions";

type Props = {
  inquiryId: string;
  status: string;
};

export function InquiryActions({ inquiryId, status }: Props) {
  const t = useTranslations("app.inquiries.detail.actions");
  const router = useRouter();
  const [working, setWorking] = useState(false);

  const canMarkContacted = status === "new";
  const canArchive = status !== "converted" && status !== "archived";

  if (!canMarkContacted && !canArchive) return null;

  async function run(action: () => Promise<{ ok: true } | { error: string }>, successMsg: string) {
    setWorking(true);
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
      setWorking(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canMarkContacted && (
        <Button
          variant="outline"
          size="sm"
          disabled={working}
          onClick={() => run(() => markContactedAction(inquiryId), t("contactedToast"))}
        >
          {t("markContacted")}
        </Button>
      )}
      {canArchive && (
        <Button
          variant="ghost"
          size="sm"
          disabled={working}
          onClick={() => run(() => archiveInquiryAction(inquiryId), t("archivedToast"))}
        >
          {t("archive")}
        </Button>
      )}
    </div>
  );
}
