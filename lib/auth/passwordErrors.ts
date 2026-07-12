import { UnprocessableEntityException } from "@workos-inc/node";

// WorkOS doesn't expose a stable typed code for "new password matches an
// old one" — the specific reason is folded into UnprocessableEntityException's
// message text (see the SDK's exception constructor), not retained as a
// queryable field, so detect it by keyword instead of an exact code.
export function isPasswordReusedError(err: unknown): boolean {
  if (!(err instanceof UnprocessableEntityException)) return false;
  const haystack = `${err.code ?? ""} ${err.message}`.toLowerCase();
  return haystack.includes("reus") || haystack.includes("previous");
}
