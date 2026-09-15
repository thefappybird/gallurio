/**
 * `weekday: "short"` is not stable across ICU builds for Thai: Node renders
 * "อา." while Chromium renders "อาทิตย์". A date formatted during SSR then
 * hydrates with different text, and React discards the server HTML and
 * remounts the subtree — which on `/th/bookings` swallows the first click on
 * the table. "narrow" ("อา") is byte-identical in both engines and is the same
 * abbreviation a Thai reader expects, so Thai takes that instead. Every other
 * locale is unaffected and keeps "short".
 */
export function stableWeekdayStyle(locale: string): "short" | "narrow" {
  return locale.split("-")[0] === "th" ? "narrow" : "short";
}
