"use client";
import { toast } from "sonner";

export function toastActionResult<T extends { ok?: boolean; error?: string }>(
  result: T | null | undefined,
  successMessage: string
): result is T & { ok: true } {
  if (!result || result.error) {
    toast.error(result?.error ?? "Action failed — please try again");
    return false;
  }
  toast.success(successMessage);
  return true;
}
