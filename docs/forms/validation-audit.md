# Validation errors — audit and outcome

**Status:** executed. This began as a findings-only audit; it now records what
shipped, what was deliberately left alone, and the follow-ups.

**Goal:** every validation error shows a red outline on the offending control
**plus** a message, consistently placed, with colour never the only signal.

---

## The original finding

There was **no form-field primitive** in this codebase. Every error message was a
hand-rolled `<p className="text-xs text-destructive">` — 153 occurrences across 62
files. The real problem was accessibility, not looks: most error elements had no
`role="alert"`, no `aria-describedby` and no `aria-invalid`, so screen-reader users
got colour as the only signal and never heard the message.

The fix was cheap because the red outline already existed on `input.tsx` and
`textarea.tsx` and was simply never switched on — for most surfaces this was one
attribute, not a restyle.

## What shipped

### The primitive — `components/ui/form-field.tsx`

A thin label + control + error stack. It generates the error id, sets
`aria-invalid` and `aria-describedby` on the control, and gives the message
`role="alert"`. Registered in `REUSABLE_CODE.md`.

Two exports, because one shape does not fit every surface:

- `FormField` — for the common label + control + error stack.
- `useFieldError(error?, { id?, describedBy? })` — for controls whose existing
  layout the wrapper would disrupt (an input inside a relative wrapper with a
  show/hide toggle, a grid-embedded field, a search/picker UI).

**Children are a render prop, not a cloned element.** `cloneElement` cannot serve
`Controller`-wrapped fields, `LocationPicker` (whose prop is `ariaDescribedby`,
not `aria-describedby`), or a control nested inside a wrapper. A render prop
handles all of them with one code path and no magic.

It has no react-hook-form import: the same wrapper serves RHF, `useActionState`
and plain `useState` surfaces identically.

Composition rule, matching `location-picker.tsx`: existing `aria-describedby`
values and hint ids are **joined**, never clobbered — error id first.

### Three findings the audit missed

1. **`select.tsx` and `combobox.tsx` had no `aria-invalid:` styling at all.**
   Setting `aria-invalid` on a dropdown produced *no visual change*. Without
   closing this, the whole exercise would have failed silently on every select.
   `timezone-combobox.tsx` had neither the styling nor an aria passthrough.

2. **The booking wizard never populated `errors.client`.** `useForm` had **no
   resolver** and its `Controller`s registered no `rules`, so `trigger()` always
   resolved true. `validateStep` did its own imperative checks and returned
   `false` without a message. A malformed email did not even block the step — it
   advanced silently and failed server-side. The audit assumed those errors
   existed but went unrendered; in fact they were never produced.

   Fixed by safe-parsing the watched value against the exported
   `bookingClientSchema` and setting a manual error, matching the
   `amount.deposit` idiom already in that file. A global `zodResolver` was
   deliberately *not* added: the wizard's step gating is imperative on purpose,
   and validating the whole schema would start blocking steps on unrelated
   fields.

3. **Three forms were missing `noValidate`** (`client-form-modal.tsx`,
   `_business-form.tsx`, `public-page/_form.tsx`). For their `type="email"`
   inputs the browser's native constraint validation swallowed the submit event
   before react-hook-form ran, so the schema's message never appeared and the
   user saw the browser's own bubble instead. Every other RHF surface here
   already set it. Each fix is covered by a test that fails without it.

### Surfaces migrated

- **Bookings** — all four wizard steps, plus `editable-field.tsx`, the inline-edit
  primitive behind every inline edit in the booking detail modal.
- **Clients** — `client-form-modal.tsx`.
- **Settings** — workspace business form, public page form, account avatar.
  The password and MFA sections were already conformant and were left untouched.
- **Onboarding** — workspace and business steps, preserving the slug step's live
  status indicator by passing its id through rather than overwriting it.
- **Teams** — the create and rename dialogs now parse against the exported team
  schemas instead of re-implementing the name rules (including a duplicated max
  length that could drift), mapping the issue code back to the existing localized
  copy so users still see translated text rather than the schema's English.
- **Billing** — promo-code inputs in the billing panel, subscribe panel and
  onboarding plan step.
- **Auth** — see below.

### Auth per-field errors

`ActionResult` gained an optional `fieldErrors` map, populated from the Zod issues
and the two password-mismatch branches. Field keys map to **localized copy**, not
Zod's hardcoded English — seven new message keys across all five locales. The
mapping is an **allowlist**, so `turnstileToken`, `token` and `returnTo` can never
surface as a field.

> **Account-existence privacy is preserved deliberately.** A failed credential
> check still returns only the generic form-level error with no `fieldErrors`, and
> the forms mark no field invalid in that case. Per-field errors in sign-in are
> limited to format validation. Covered by a unit test on the action and an e2e
> test on the form.

Where a field message would repeat the form-level sentence verbatim, the
top-level copy is suppressed so the same text is not shown twice.

## Deliberately not changed

- **`ContactForm.tsx` markup is frozen.** It is inline-styled so the portfolio
  brand kit (`--pf-*`) themes it, and its `.pf-contact-form` stylesheet targets
  descendant elements directly. Swapping in the Tailwind wrapper would regress
  public pages to CRM tokens. It already set `aria-invalid` and `role="alert"`, so
  it received error ids and `aria-describedby` only. Session error ids are
  index-scoped so two sessions cannot collide.
- **The three location fields** in `event-pricing-step.tsx`, `_business-form.tsx`
  and `ContactForm.tsx` — `LocationPicker` already owns its own error slot with
  full aria wiring.
- **Gallery picker dialogs** — every destructive message there is a failed fetch
  or upload notice, not a field error. They got `role="alert"` where it was
  missing, and no invented field association.
- **Conflict warnings, required-marker asterisks, and form-level root errors**
  are not field errors and were left alone.
- **The enforcement lint rule** (originally chunk 6) was skipped. A
  "`text-destructive` without `aria-describedby`" rule has high false-positive
  risk: the class is also used on buttons, badges, KPI deltas and destructive
  menu items. Revisit once the pattern has settled.

## Verification

- `tsc --noEmit` clean; full unit sweep **5221 passed / 0 failed**.
- Playwright (`e2e/validation-errors.spec.ts`), at 375/768/1280 where the surface
  warrants it: the wizard's new-client email, the client modal's email (the
  `noValidate` regression guard), that `aria-invalid` actually paints an outline
  on a select trigger, the sign-in no-enumeration property, and the sign-up
  mismatch landing on the confirm field.

Each e2e assertion checks the whole contract — the control is marked invalid
*and* its message is reachable from it, not merely adjacent to it.

## Follow-ups

1. **Zod validator messages are hardcoded English** across `lib/validators/*`
   (`"Invalid email"`, `"Name is required"`). The auth actions now map field keys
   to localized copy, but every other surface still renders the raw schema string
   to users in all five locales. Fixing this properly is a schema-wide change.
2. **`aria-invalid` on a `role="button"` trigger** — `combobox.tsx` and
   `timezone-combobox.tsx` carry an `eslint jsx-a11y/role-supports-aria-props`
   warning. The visual outline works, but the attribute is not strictly valid
   ARIA on a button; giving those triggers `role="combobox"` would be correct.
3. **Two duplicate `PromoCodePanel` implementations** (`plan-form.tsx` and
   `subscribe/_panel.tsx`) — recorded in `REUSABLE_CODE.md` as an extraction
   candidate, not unified here.
4. **`ThemeGrid.tsx`'s `theme-name-error` id** appears to have no matching
   rendered message element on the current-tile path. Pre-existing; not touched.

## Carried over from the item 5 audit

`client-info-card.tsx` gained a `message` prop, a warning-indicator region, and
now renders `ClientMatchDialog` itself. An earlier `onResolveClient` callback prop
was removed because neither parent ever passed it, so the indicator was
unreachable. **If you add a form surface that needs a dialog, check that a parent
actually wires it** — tests and `tsc` both pass without.

## Tracked follow-ups from the original audit (still deliberately not built)

1. **Defer client + draft-booking creation to inquiry approval.**
   `inquirySubmission.ts` creates a Client *and* a draft Booking at submission
   time because `Booking.clientId` is required. The root-cause fix rewrites 8
   `draftBookingId` call sites in `inquiries/_actions.ts`, plus inquiry conflict
   detection, the calendar overlay and `booking-draft-card`'s edit UX.
   Branch-sized on its own.
2. **"Not a duplicate" dismissal** for the client-match indicator, if users
   report false-match noise. Deliberately omitted: the indicator only appears
   inside an already-open inquiry, so a false match is bounded noise.
