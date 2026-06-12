import { z } from "zod";
import {
  brandKitSchema,
  portfolioContactConfigSchema,
  portfolioHeaderConfigSchema,
  portfolioCollectionsPopupConfigSchema,
  portfolioPuckDataSchema,
} from "./publicPage";
import { DRAFT_NAME_MAX } from "@/lib/page-builder/drafts";

// Empty/whitespace -> trimmed to "" -> min(1) fails with the UI's error key.
export const draftNameSchema = z
  .string()
  .trim()
  .min(1, "name_required")
  .max(DRAFT_NAME_MAX);

export const draftSnapshotSchema = z.object({
  templateId: z.string().max(64).optional().or(z.literal("")),
  data: portfolioPuckDataSchema,
  brandKit: brandKitSchema,
  contact: portfolioContactConfigSchema,
  header: portfolioHeaderConfigSchema,
  collectionsPopup: portfolioCollectionsPopupConfigSchema,
  formLocale: z.string().max(8).optional().or(z.literal("")),
});

export const createDraftSchema = draftSnapshotSchema.extend({
  name: draftNameSchema,
});

export const updateDraftSchema = draftSnapshotSchema.extend({
  id: z.string().min(1).max(64),
  name: draftNameSchema,
});

export type DraftSnapshotInput = z.infer<typeof draftSnapshotSchema>;
export type CreateDraftInput = z.infer<typeof createDraftSchema>;
export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;
