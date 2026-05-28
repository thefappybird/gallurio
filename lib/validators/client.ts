import { z } from "zod";
// Import from the pure libphonenumber-js (no React) rather than
// react-phone-number-input: this validator is shared with server-only code
// (server actions, the bookings import route), and pulling the React component
// library into server bundles breaks the production build.
import { isValidPhoneNumber } from "libphonenumber-js";

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

// Trim surrounding whitespace before validating so a stored/pasted number with
// padding (e.g. " +639171234567 ") isn't wrongly rejected, and blank → null so
// empty inputs aren't persisted as "". Shared with the booking wizard's
// new-client block so both flows enforce the same E.164 contract.
export const optionalPhone = z
  .preprocess((v) => {
    if (typeof v !== "string") return v;
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  }, z.string().nullable().optional())
  .refine((v) => v == null || isValidPhoneNumber(v), {
    message: "Invalid phone number",
  });

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
