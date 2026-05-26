import { z } from "zod";

// Form inputs always submit strings — RHF turns an untouched <input> into "",
// not null. Coerce "" / whitespace to null on optional fields before running
// the typed validator so blank emails don't fail .email() and blank phones
// don't get persisted as empty strings.
const blankToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optionalEmail = z.preprocess(
  blankToNull,
  z.string().email("Invalid email").toLowerCase().trim().nullable().optional()
);

const optionalPhone = z.preprocess(
  blankToNull,
  z.string().max(40).trim().nullable().optional()
);

export const clientFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(120).trim(),
  email: optionalEmail,
  phone: optionalPhone,
  source: z.enum(["form", "manual", "referral", "import"]).default("manual"),
  tags: z.array(z.string().max(40).trim()).default([]),
  notes: z.string().max(2000).trim().default(""),
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;
