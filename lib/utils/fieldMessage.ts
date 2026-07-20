// react-hook-form widens `errors.<field>` to a broader FieldError-ish shape
// when the resolver schema is a ZodEffects (e.g. wrapped in `.superRefine`)
// whose generic helper collapses input/output typing to `any`. `.message` on
// that shape is no longer guaranteed to be a plain string ReactNode. This
// helper narrows it defensively at render sites without touching the schema.
export function fieldMessage(error: { message?: unknown } | undefined): string | undefined {
  return typeof error?.message === "string" ? error.message : undefined;
}
