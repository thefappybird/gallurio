# Validation-error styling audit

**Status:** findings only — no code changes. This document exists to be executed from a
separate branch.

**Goal:** every validation error in Gallurio shows a red outline on the offending control
**plus** a message, consistently placed, with colour never the only signal.

**Why it is a document and not a branch:** the work shares form components with the
optional-client-contact-fields work (item 5), which is landing on
`fix/import-client-validation` now. Doing both at once would conflict in
`client-form-modal.tsx`, `client-info-card.tsx` and `location-picker.tsx`. See
[What item 5 moves underneath you](#what-item-5-moves-underneath-you) before starting.

---

## The headline finding

**There is no form-field primitive in this codebase.** No `components/ui/form.tsx`, and no
`FormField` / `FormItem` / `FormMessage` / `FormLabel` / `FormDescription` / `ErrorText` /
`field-error` anywhere outside `node_modules`. Every error message in the app is a
hand-rolled `<p className="text-xs text-destructive">`.

The consequence is not mainly visual, it is accessibility. Across the app:

- `role="alert"` appears in ~20 files
- `aria-describedby` in ~12
- `aria-invalid` in ~8

and **most error elements have none of the three**.

### The red outline is already built — it is just never switched on

`components/ui/input.tsx:12` already carries the full error treatment:

```
aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20
dark:aria-invalid:border-destructive/50
```

`components/ui/textarea.tsx:10` has the same. Neither component sets `aria-invalid` itself —
callers must, and almost none do. **So for most surfaces the fix is one attribute, not a
restyle.** That is what makes this audit cheap to execute.

### Reference implementation already in the repo

`lib/page-builder/brandKitPicker/ThemeTile.tsx:36,109-110` is the only place with complete
wiring:

```tsx
aria-invalid={nameInvalid || undefined}
aria-describedby={nameInvalid ? nameErrorId : undefined}
```

It is covered by `ThemeTile.test.tsx:158-166`. Copy this shape.

Also relevant: `components/app/slug-status-indicator.tsx` is the house pattern for a single
persistent `aria-live="polite"` region that is text + icon, never colour-only
(`REUSABLE_CODE.md:74`).

---

## Proposed shared mechanism

**Add `components/ui/form-field.tsx`.** `REUSABLE_CODE.md` has **no** entry for a
form-field/error primitive — that gap is currently unrecorded, and the new component must be
registered there in the same change.

Deliberately thin — a wrapper, not a form framework:

- renders label + control slot + error `<p>`
- generates the error id
- sets `aria-invalid` and `aria-describedby` on the child control
- error `<p>` gets `role="alert"` and lives directly under the control

It must NOT own layout, spacing beyond the label/control/error stack, or any RHF coupling —
several surfaces here are `useActionState` or plain `useState`, and the wrapper has to serve
all three.

**Reuse, do not reinvent:** `lib/utils/fieldMessage.ts:6-8` (`fieldMessage`) already narrows an
RHF error to a plain string and is registered at `REUSABLE_CODE.md:103`.

---

## Validation strategies in play

Three, and the wrapper has to serve all of them:

| Strategy | Count | Where |
|---|---|---|
| RHF + `zodResolver` | 12 `useForm` call sites | clients, bookings wizard, public ContactForm, settings ×4, onboarding ×2, book-demo |
| Server Action via `useActionState` | 7 | all of `(auth)` |
| Manual `useState` | long tail | teams dialogs, gallery pickers, brand-kit editor, plan/billing panels, `editable-field.tsx` |

---

## Inventory

Conformance key: **C** = red outline + message + aria wiring · **P** = message but no
outline/aria · **N** = neither, or error not surfaced at all.

### bookings

| Surface | File | Verdict | Notes |
|---|---|---|---|
| Booking wizard | `_components/booking-wizard-modal.tsx` | P | per-step error set drives `animate-shake` on the step chip (`:745`, `:937`); fields themselves unwired |
| Wizard client step | `_components/booking-wizard-steps/client-step.tsx` | **N** | see Known offenders |
| Wizard event/pricing step | `_components/booking-wizard-steps/event-pricing-step.tsx` | C | fixed by item 5 — location error now under the input |
| Booking detail modal | `_components/booking-detail-modal.tsx` | P | 152 KB; inline edits via `editable-field` |
| Inline edit primitive | `_components/editable-field.tsx` | **N** | see Known offenders |
| CSV import dialog | `_components/csv-import-dialog.tsx` | P | row errors listed in a table, not per-field |
| Import results | `_components/import-results-dialog.tsx` | n/a | display only |
| Invoice theme dialog | `_components/invoice-theme-dialog.tsx` | P | |
| Confirm dialogs ×5 | `cancel-confirm-dialog`, `past-date-confirm-dialog`, `session-edit-confirm-dialog`, `wizard-conflict-confirm-dialog`, `unsaved-changes-dialog` | n/a | no inputs |
| Toolbar / team filter | `bookings-toolbar.tsx`, `team-filter-control.tsx`, `team-picker.tsx` | n/a | filters, not validated input |

### clients

| Surface | File | Verdict | Notes |
|---|---|---|---|
| Client form modal | `_components/client-form-modal.tsx` | P | four hand-rolled `<p>` at `:178-180, :192-194, :213-215, :294-296`; no `aria-invalid` anywhere. **Item 5 changes this file** |
| Client detail modal | `_components/client-detail-modal.tsx` | P | |
| Deactivate / unsaved | `_components/deactivate-client-dialog.tsx`, `unsaved-changes-dialog.tsx` | n/a | |

### inquiries

| Surface | File | Verdict |
|---|---|---|
| Inquiry detail modal | `_components/inquiry-detail-modal.tsx` | P |
| Booking draft card | `[id]/_components/booking-draft-card.tsx` | P |
| Client info card | `[id]/_components/client-info-card.tsx` | P — **item 5 changes this file** |
| Event request card | `[id]/_components/event-request-card.tsx` | n/a |
| Inquiry actions | `[id]/_components/inquiry-actions.tsx` | n/a |
| Calendar manager | `_components/inquiries-calendar-manager.tsx` | n/a |

### settings

| Surface | File | Verdict |
|---|---|---|
| Workspace business | `settings/workspace/_business-form.tsx` | P → location field now C (item 5) |
| Public page | `settings/public-page/_form.tsx` | P |
| Account panel | `settings/account/_panel.tsx` | P |
| Password | `settings/account/_password-section.tsx` | P |
| MFA | `settings/account/_mfa-section.tsx` | P |

### teams

| Surface | File | Verdict |
|---|---|---|
| Invite form | `_components/invite-form.tsx` | P |
| Team dialogs | `_components/team-dialogs.tsx` | **N** — see Known offenders |
| Member details / remove / downgrade / drawer / sidebar | `member-details-dialog.tsx`, `remove-member-dialog.tsx`, `downgrade-block-modal.tsx`, `team-detail-drawer.tsx`, `view-members-sidebar.tsx` | n/a |

### portfolio + public

| Surface | File | Verdict |
|---|---|---|
| Public contact form | `app/(public)/w/[orgSlug]/_components/ContactForm.tsx` | P → location field now C (item 5). Styles via inline `style`, not Tailwind — the wrapper needs a style escape hatch here |
| Contact modal | `app/(public)/w/[orgSlug]/_components/ContactModal.tsx` | n/a |
| Preview contact modal | `app/[locale]/portfolio-preview/_components/PreviewContactModal.tsx` | n/a |
| Editor dialogs ×13 | `portfolio/_components/`: `ContactPanelDialog`, `ContactFormPreview`, `HeaderPanelDialog`, `HeaderFormPreview`, `ThemePanelDialog`, `CollectionsPopupPanelDialog`, `DraftsDialog`, `PublishDialog`, `PortfolioEntryDialog`, `StoryPromptDialog`, `TemplatePickerDialog`, `UnsavedChangesDialog`, `DemoGateModal` | mixed P / n/a |

### gallery / page-builder

| Surface | File | Verdict |
|---|---|---|
| Media picker | `lib/page-builder/galleryPicker/MediaPicker.tsx` | P (`:886`) |
| Collection picker | `.../CollectionPicker.tsx` | P (`:345`) |
| Collections manager | `.../CollectionsManagerDialog.tsx` | P (`:190`) |
| Create collection | `.../CreateCollectionDialog.tsx` | P (`:290`) |
| Edit collection | `.../EditCollectionDialog.tsx` | P (`:278`) |
| Theme tile | `lib/page-builder/brandKitPicker/ThemeTile.tsx` | **C — reference implementation** |
| Theme editor | `.../useThemeEditor.ts` | N (`:53,58,66`) |
| Style toolkit field | `lib/page-builder/StyleToolkitField.tsx` | n/a |

### onboarding · auth · billing · marketing

| Surface | File | Verdict |
|---|---|---|
| Workspace / business steps | `(onboarding)/onboarding/workspace/workspace-form.tsx`, `business/business-form.tsx` | P |
| Plan / done steps | `.../plan/plan-form.tsx`, `.../done/done-form.tsx` | P (ad-hoc `role="alert"` at `plan-form.tsx:206,345,359,439`) |
| Auth ×6 | `(auth)/sign-in/_sign-in-form.tsx`, `sign-in/mfa/_mfa-form.tsx`, `sign-up/_sign-up-form.tsx`, `verify-email/_verify-email-form.tsx`, `forgot-password/_forgot-password-form.tsx`, `reset-password/_reset-password-form.tsx` | P — form-level only, no per-field |
| Billing | `settings/billing/_panel.tsx` (`:197,330`), `subscribe/_panel.tsx` (`:151,207`) | P |
| Book demo | `(marketing)/book-demo/_components/BookDemoForm.tsx` | P |

---

## Known offenders — call these out explicitly

1. **`booking-wizard-steps/client-step.tsx:243-257` — new-client email and phone render NO
   error at all.** Only `errors.client.name` is surfaced (`:237-241`). The Zod rules exist
   (`optionalEmail` / `optionalPhone` in `lib/validators/client.ts`), so a bad email or phone
   fails silently in the UI and only surfaces post-submit from the server. This is the worst
   single case in the app and should be fixed first.

2. **`editable-field.tsx:62-63,122,179,380-381` — the inline-edit primitive has a bespoke
   validation contract** (`validate?: (v) => string | null`) and its error `<span>` has no
   `aria-invalid`, no `aria-describedby`, no `role="alert"` and no id. Every inline edit in the
   booking detail modal inherits this.

3. **`team-dialogs.tsx:89-123`** — hand-written `nameError` with hardcoded length rules and
   duplicate-name mapping, duplicating logic that belongs in a validator.

4. **`useThemeEditor.ts:53,58,66`** — three separate `*NameError` useState values.

5. **Auth forms carry a single form-level error only.** Per-field errors are never shown, so a
   user with two bad fields fixes them one round-trip at a time.

---

## Work list

Grouped so each chunk lands independently.

### Chunk 1 — the primitive
- [ ] Add `components/ui/form-field.tsx` (label + control slot + error, generated id,
      `aria-invalid` + `aria-describedby` on the child, `role="alert"` on the message)
- [ ] Support a style escape hatch for the inline-styled public surfaces (see
      `ContactForm.tsx`; `location-picker.tsx` already models this with `errorStyle`)
- [ ] Register it in `REUSABLE_CODE.md`
- [ ] Unit tests: id wiring, `aria-invalid` toggling, message placement, no-error case renders
      nothing

### Chunk 2 — highest-value gaps (do before the bulk migration)
- [ ] `client-step.tsx` — surface email and phone errors at all
- [ ] `editable-field.tsx` — add `aria-invalid` / `aria-describedby` / `role="alert"` / error id

### Chunk 3 — migrate the 12 RHF surfaces
- [ ] clients: `client-form-modal.tsx` *(wait for item 5)*
- [ ] bookings: `booking-wizard-modal.tsx` + steps
- [ ] public: `ContactForm.tsx` *(location field already done by item 5 — do not re-migrate it)*
- [ ] settings: `_business-form.tsx` *(same caveat)*, `public-page/_form.tsx`,
      `account/_panel.tsx`, `_password-section.tsx`, `_mfa-section.tsx`
- [ ] onboarding: `workspace-form.tsx`, `business-form.tsx`
- [ ] marketing: `BookDemoForm.tsx`

### Chunk 4 — manual-validation tail
- [ ] `team-dialogs.tsx`
- [ ] `useThemeEditor.ts`
- [ ] the five `galleryPicker` dialogs
- [ ] `plan-form.tsx`, billing panels

### Chunk 5 — auth per-field errors
- [ ] Return per-field errors from the auth Server Actions, then adopt the wrapper in all six
      forms

### Chunk 6 — enforcement
- [ ] Lint rule or test that fails when a `text-destructive` message element has no associated
      `aria-describedby`, so this cannot regress

---

## What item 5 moves underneath you

Item 5 (optional client email/phone, name-collision + inquiry-link flows) is landing on
`fix/import-client-validation`. When you branch, expect:

- **`components/ui/location-picker.tsx`** — gained `error` and `errorStyle` props and now owns
  its own error slot, rendered under the input and above the map in *both* edit and display
  mode, with `aria-invalid` on the input and its error id prepended to `aria-describedby`.
- **The error `<p>` was DELETED** from `event-pricing-step.tsx`, `ContactForm.tsx` and
  `_business-form.tsx`. **Do not migrate those three location fields to the new wrapper — they
  are already conformant.**
- **`app/globals.css`** — `.animate-shake` gained a `prefers-reduced-motion` guard. Reuse the
  existing utility rather than defining another.
- **`client-form-modal.tsx`** — `onSubmit` gains a name-collision branch and a new root-level
  error path.
- **`client-info-card.tsx`** — gains a `clientId` prop and a new warning-indicator region.
- **New file `components/app/client-match-dialog.tsx`** — a brand-new form surface. It should
  adopt the wrapper from day one rather than being migrated later.
- **`ContactForm.tsx`** — note the RHF gotcha found while doing item 5: a `Controller`'s render
  callback does **not** re-run on an errors-only change, so any error message must be resolved
  in the component body and passed in. Expect the same trap in every `Controller`-wrapped field
  you migrate.

## Tracked follow-ups (decided, deliberately not built)

1. **Defer client + draft-booking creation to inquiry approval.** `inquirySubmission.ts`
   currently creates a Client *and* a draft Booking at submission time, because
   `Booking.clientId` is required. Item 5c works around the resulting orphan by deleting it on
   re-link. The root-cause fix rewrites 8 `draftBookingId` call sites in
   `inquiries/_actions.ts`, plus inquiry conflict detection, the calendar overlay and
   `booking-draft-card`'s edit UX. Branch-sized on its own.
2. **"Not a duplicate" dismissal** for the 5c match indicator, if users report false-match
   noise. Deliberately omitted: the indicator only appears inside an already-open inquiry, so a
   false match is bounded noise rather than persistent clutter.
