"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { setUrlParams } from "@/lib/utils/url-params";
import type { BookingTeamOption } from "../_data/team-options";
import type { SupportedCurrency } from "@/lib/validators/workspace";
import { BookingWizardLazy } from "./booking-wizard-dynamic";

const BookingDetailLazy = dynamic(
  () => import("./booking-detail-modal").then((m) => m.BookingDetailModal),
  { ssr: false }
);

const OBJECT_ID = /^[a-f0-9]{24}$/i;

type Props = {
  locale: string;
  teams?: BookingTeamOption[];
  writableTeams?: BookingTeamOption[];
  businessComplete?: boolean;
  workspaceId?: string;
  readOnly?: boolean;
  /** Bookings page only: `view` + `defaultCurrency` enable the table-view ?edit wizard. */
  view?: string;
  defaultCurrency?: SupportedCurrency;
  workspaceTimezone?: string;
};

/**
 * Client host for the URL-driven booking modals (?detail / ?edit). Mounting
 * them here instead of in the server page means opening, closing and switching
 * cost zero RSC fetches: history.pushState updates useSearchParams directly.
 * `key` per id gives each booking a fresh instance (local `open` state resets).
 */
export function BookingUrlModals({
  locale,
  teams,
  writableTeams,
  businessComplete,
  workspaceId,
  readOnly,
  view,
  defaultCurrency,
  workspaceTimezone,
}: Props) {
  const searchParams = useSearchParams();
  const detail = searchParams.get("detail");
  const edit = searchParams.get("edit");
  const detailId = detail && OBJECT_ID.test(detail) ? detail : null;
  const editEnabled = view !== undefined && view !== "calendar" && !!defaultCurrency;
  const editId = editEnabled && edit && OBJECT_ID.test(edit) ? edit : null;

  // Malformed ids never reach the API (it would 400 and show a load error).
  useEffect(() => {
    if (detail && !detailId) setUrlParams((p) => p.delete("detail"), "replace");
  }, [detail, detailId]);
  useEffect(() => {
    if (editEnabled && edit && !editId) setUrlParams((p) => p.delete("edit"), "replace");
  }, [editEnabled, edit, editId]);

  return (
    <>
      {detailId ? (
        <BookingDetailLazy
          key={detailId}
          bookingId={detailId}
          locale={locale}
          teams={teams}
          writableTeams={writableTeams}
          businessComplete={businessComplete}
          workspaceId={workspaceId}
          readOnly={readOnly}
        />
      ) : null}
      {editId ? (
        <BookingWizardLazy
          key={editId}
          mode="edit"
          bookingId={editId}
          defaultCurrency={defaultCurrency}
          locale={locale}
          workspaceTimezone={workspaceTimezone}
          teams={writableTeams}
        />
      ) : null}
    </>
  );
}
