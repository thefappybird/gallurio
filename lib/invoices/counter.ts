import mongoose from "mongoose";
import { Counter } from "@/lib/db/models";

export async function getNextInvoiceSeq(workspaceId: mongoose.Types.ObjectId): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { workspaceId, key: "invoice" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  ).lean();
  return doc!.seq;
}

export function formatInvoiceNumber(seq: number): string {
  return `INV-${String(seq).padStart(6, "0")}`;
}
