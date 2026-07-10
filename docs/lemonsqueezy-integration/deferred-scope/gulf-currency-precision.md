# Deferred: Gulf 3-Decimal Currency Display Precision

## What it is

`lib/utils/format-currency.ts` hard-codes `maximumFractionDigits: 0` for all
currencies. The Gulf currencies `KWD`, `BHD`, and `OMR` are ISO 4217 3-decimal
currencies (minor unit = 1/1000), and `AED`, `SAR`, and `QAR` are 2-decimal.
Under the current setting, `KWD 12.500` renders as `KD 13` (rounded to whole
dinar), which loses sub-unit precision.

## Why it is deferred (not changed now)

The `maximumFractionDigits: 0` override is **intentional and test-pinned** for
the MVP launch market (PHP / Philippine Peso). The existing test
`lib/utils/format-currency.test.ts` asserts:

```ts
it("formats PHP without fractional digits", () => {
  expect(formatMoney(24850, "PHP", "en")).toMatch(/24,850/);
  expect(formatMoney(24850, "PHP", "en")).not.toMatch(/\.\d/);
});
```

The app stores and displays booking amounts in whole pesos (`amount.total`,
`amount.deposit` — both integer). Changing `maximumFractionDigits` globally
would break the existing PHP test and introduce unexpected decimal display for
the primary market before Gulf is even shipped.

## Impact

- **Billing correctness**: unaffected. Lemon Squeezy bills by `variantId`;
  `formatMoney` is display-only in the CRM (booking amounts, invoice previews).
- **Display in Gulf**: a photographer in Kuwait quoting `KWD 12.500` would
  see `KD 13`. This is a display rounding artifact, not a billing error.
- **Who is affected**: Gulf tenants only — Gulf currency support itself
  (`AED/SAR/QAR/KWD/OMR/BHD`) was added in this billing migration but the
  Arabic locale and Gulf-specific UX work is deferred to the `arabic-rtl` task.

## How to fix when the arabic-rtl task lands

Option A (currency-natural, recommended): remove `maximumFractionDigits: 0`
entirely and let `Intl.NumberFormat` use each currency's natural minor units:

```ts
// lib/utils/format-currency.ts
export function formatMoney(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}
```

Then update `format-currency.test.ts`:
- Change the PHP "no fractional digits" test to allow 0 or 2 decimals (or
  explicitly test that `₱24,850.00` is acceptable), **or** pass pre-rounded
  integers from callers that need whole-peso display (the preferred approach
  since booking amounts are already integers).
- Add KWD and BHD test cases asserting 3-decimal display.

Option B (branch by currency): keep 0 decimals for zero-decimal and
whole-display currencies, default for others:

```ts
const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW"]); // PHP is NOT zero-decimal
export function formatMoney(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...(ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
      ? { maximumFractionDigits: 0 }
      : {}),
  }).format(amount);
}
```

Note: PHP (`₱`) is NOT an ISO zero-decimal currency — it has 2 decimal places
natively. The current `maximumFractionDigits: 0` is a deliberate product
choice for whole-peso display, not a currency property. If you adopt Option B,
you need to decide explicitly whether PHP stays at 0 decimals and add it to the
set, or allow the natural 2 decimals.

## Related files

- `lib/utils/format-currency.ts` — the 0-decimal override
- `lib/utils/format-currency.test.ts` — pins PHP to 0 decimals
- `lib/validators/workspace.ts` — defines `SUPPORTED_CURRENCIES` incl. Gulf
- `docs/lemonsqueezy-integration/deferred-scope/arabic-rtl.md` — broader Gulf UX context
