import { z } from "zod";

export const slugSchema = z
  .string()
  .min(3, "At least 3 characters")
  .max(50, "At most 50 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens only");

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, "At least 2 characters").max(80, "At most 80 characters").trim(),
  slug: slugSchema,
  businessType: z.enum([
    "photographer",
    "venue",
    "planner",
    "stylist",
    "catering",
    "entertainer",
    "other",
  ]),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
