import { z } from "zod";

export const clientFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(120).trim(),
  email: z.string().email("Invalid email").toLowerCase().trim().optional().nullable(),
  phone: z.string().max(40).trim().optional().nullable(),
  source: z.enum(["form", "manual", "referral", "import"]).default("manual"),
  tags: z.array(z.string().max(40).trim()).default([]),
  notes: z.string().max(2000).trim().default(""),
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;
