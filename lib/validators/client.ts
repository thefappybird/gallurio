import { z } from "zod";

// Form inputs always submit strings — RHF turns an untouched <input> into "",
// not null. Coerce "" / whitespace to null on optional fields before running
// the typed validator so blank emails don't fail .email() and blank phones
// don't get persisted as empty strings.
const blankToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

// Trim before .email() so pasted addresses with surrounding whitespace aren't
// rejected, and before lowercasing so the normalized output is consistent.
const optionalEmail = z.preprocess(
  blankToNull,
  z.string().trim().email("Invalid email").toLowerCase().nullable().optional()
);

const optionalPhone = z.preprocess(
  blankToNull,
  z.string().trim().max(40).nullable().optional()
);

export const clientFormSchema = z.object({
  // Trim before .min(1) so whitespace-only names ("   ") fail validation
  // instead of passing and parsing to an empty string.
  name: z.string().trim().min(1, "Name is required").max(120),
  email: optionalEmail,
  phone: optionalPhone,
  source: z.enum(["form", "manual", "referral", "import"]).default("manual"),
  tags: z.array(z.string().trim().max(40)).default([]),
  notes: z.string().trim().max(2000).default(""),
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;
