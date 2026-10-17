import { BOOKING_IMPORT_PROGRESS_EVENT, type BookingImportProgress } from "@/lib/bookings/import-progress";
import { getIO } from "./io";

/** Only the initiating owner sees live import progress. Team members get terminal notifications. */
export function emitImportProgress(actorUserId: string, progress: BookingImportProgress): void {
  try {
    getIO()?.to(`user:${actorUserId}`).emit(BOOKING_IMPORT_PROGRESS_EVENT, progress);
  } catch (error) {
    console.error("[bookings.import] progress emit failed", error);
  }
}
