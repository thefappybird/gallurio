export const BOOKING_IMPORT_PROGRESS_EVENT = "booking-import:progress" as const;

export type BookingImportProgress = {
  workspaceId: string;
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  doneGroups: number;
  totalGroups: number;
};
