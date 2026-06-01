# Deferred: Arabic Locale and RTL Layout

## What it is

Adding Arabic (`ar`) as a sixth locale with full right-to-left (RTL) layout support, so that workspace owners in Gulf markets (UAE, Saudi Arabia, Qatar, Kuwait, Oman, Bahrain) get Arabic app chrome instead of English.

## Current state (interim)

The billing migration already expanded country and currency support to include the six Gulf markets (`AE, SA, QA, KW, OM, BH` with `AED, SAR, QAR, KWD, OMR, BHD`). However, `lib/i18n/localeForCountry.ts` maps all Gulf countries to `"en"` for now:

```typescript
// lib/i18n/localeForCountry.ts
case "AE": case "SA": case "QA": case "KW": case "OM": case "BH":
  return "en"; // interim — flip to "ar" when arabic-rtl.md task lands
```

Gulf tenants see English chrome today. This is acceptable for the billing PR; the Arabic task will flip the single line and ship the locale properly.

## Why it's deferred

RTL is cross-cutting — it touches the layout root, every component that uses directional CSS (margins, paddings, flex, border sides, icon positions), and requires a full message catalog. Bundling it with the billing migration would have significantly increased the PR scope and risk surface for an orthogonal concern.

---

## Steps to ship this task

### 1. Add `"ar"` to the locale list

`lib/i18n/routing.ts`:
```typescript
export const locales = ["en", "fil", "ms", "id", "th", "ar"] as const;
```

Do not add `"ar"` before `messages/ar.json` exists — next-intl will throw on locale resolution.

### 2. Create `messages/ar.json`

Machine-translate the entire `messages/en.json` catalog to Arabic and save as `messages/ar.json`. Tag entries that need human review (brand terms, legal strings, UI idioms) inline:

```json
{
  "app": {
    "dashboard": {
      "title": "لوحة التحكم"   // machine-translated, review needed
    }
  }
}
```

ICU MessageFormat plurals must use Arabic plural categories (Arabic has six — `zero`, `one`, `two`, `few`, `many`, `other`). Machine translation tools often miss this; audit all plural strings.

### 3. Set RTL on the HTML element

`app/[locale]/layout.tsx`:
```typescript
<html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
```

### 4. Flip Gulf locales

`lib/i18n/localeForCountry.ts` — the comment already points here:
```typescript
case "AE": case "SA": case "QA": case "KW": case "OM": case "BH":
  return "ar";  // was "en" — flip here
```

Update `lib/i18n/localeForCountry.test.ts` to assert Gulf countries → `"ar"` (the test currently asserts → `"en"` to guard the interim behavior).

### 5. Audit components for logical CSS

Replace physical CSS properties with logical equivalents wherever RTL mirroring is needed:

| Physical (avoid in RTL-aware code) | Logical (use instead) |
|---|---|
| `margin-left` / `ml-*` | `margin-inline-start` / `ms-*` |
| `margin-right` / `mr-*` | `margin-inline-end` / `me-*` |
| `padding-left` / `pl-*` | `padding-inline-start` / `ps-*` |
| `padding-right` / `pr-*` | `padding-inline-end` / `pe-*` |
| `border-left` / `border-r-*` | `border-inline-start` / `border-s-*` |
| `text-left` | `text-start` |
| `text-right` | `text-end` |
| `left-*` / `right-*` (positioned) | `inset-inline-start` / `inset-inline-end` |

Tailwind v4 (used in this project) ships logical property utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, etc.) natively. The sidebar, navigation, and any component with explicit left/right layout logic need auditing.

### 6. Icon mirroring

Directional icons (arrows, chevrons, back buttons) must mirror in RTL. Wrap them:

```tsx
// components/ui/directional-icon.tsx
<span className="rtl:scale-x-[-1] inline-block">
  <ChevronRight />
</span>
```

Or use `dir="auto"` on specific containers. Audit all `ChevronLeft`, `ChevronRight`, `ArrowLeft`, `ArrowRight` usages.

### 7. Third-party libraries

Libraries with their own stylesheets (react-big-calendar, recharts, Leaflet) must be re-audited for RTL. Their CSS may hard-code `left`/`right` values. Override with `!important` or RTL-specific CSS layers where needed.

### 8. Proxy / locale routing

`proxy.ts` uses next-intl's `createRouteMatcher` — adding `"ar"` to `routing.ts` is sufficient for the matcher to recognize `/ar/*` routes. No manual proxy change needed.

---

## Notes

- Gulf markets represent a significant revenue opportunity (AE/SA are high-ARPU SaaS markets). Don't block the billing PR on this — but don't delay the Arabic task once the billing PR merges.
- Arabic numerals vs. Eastern Arabic numerals: Paddle renders prices in the checkout overlay using the browser locale; the app's own `formatMoney` uses `Intl.NumberFormat` which respects locale — `ar` will render Eastern Arabic numerals (`٢٥٠ ₱`) by default. Verify this is acceptable or pass `numberingSystem: "latn"` to force Western digits.
- `KWD`, `BHD`, and `OMR` are 3-decimal currencies. `formatMoney` passes currency through to `Intl.NumberFormat`, so display is correct. The existing `maximumFractionDigits: 0` override rounds to whole amounts in the plan display — this is acceptable for plan pricing (₱250, not ₱250.00) and is unchanged.
