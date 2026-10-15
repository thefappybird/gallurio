# Bookings import and document themes

## Problem
The bookings importer worked but was hard to use: step-2 dropdowns clipped at the screen edge, developer field names and badges, strict date format, one bad cell dropped a whole row, cramped sheets. Invoice and receipt themes used their own 4 color pairs instead of the portfolio themes, and previews were too small to judge.

## What shipped
- **Import mapping:** plain-language field labels and hints (`app.bookings.import.fields.*`), "Required" badge only, advanced section renamed "Re-importing a Gallurio export". Select popups no longer clip (`components/ui/select.tsx`).
- **Combine columns:** `Assignment` may be `{ sources: string[] }` on text fields (`combinable`). `applyMapping` trims, drops blanks, joins with a space. `autoMapColumns` maps First/Last name pairs automatically. Card has `+` (combine) and `×` (remove).
- **Lenient notes:** `MappedRow.notes` (non-blocking) next to blocking `issues`. Unreadable/negative amount, unsupported currency, bad email, unmatched type/status, over-long text, over-long text import with a note. A missing title is generated silently via `titleFallback` (no note). Only missing client name or unreadable start date skips a row. Review shows total / with notes / skipped counts (ready count is on the Import button).
- **Date handling:** `defaultDateOrder(timeZone)` seeds the order. `coerceDate` accepts weekday names, ordinals, "9am"/"noon", dotted month abbreviations. Date card shows the readable result plus a "Swap day and month" link when the column is ambiguous. MM/DD radio group removed.
- **Resizable sheets:** `useSheetResize` + `<SheetResizeHandle/>` on the import, export and invoice-theme sheets. Pointer capture, rAF writes `--sheet-w` to the DOM during drag, commit to state and `localStorage` on pointerup. Arrows step 32px, Home/End jump. Phones stay full width, handle hidden.
- **Portfolio-based document themes:** the 6 `BRAND_KIT_THEME_PRESETS`, "Match my portfolio" (live published brand kit), saved portfolio themes, Custom. Band = `primaryColor`, band text = better-contrast of foreground/background (`bandText`), accent strip = `accentColor`, page body stays white. `InvoiceTheme = { preset, savedThemeId?, main, accent, text }`; `"portfolio"` resolves at render time, `"saved"`/`"custom"` use a stored snapshot so deleting a saved theme never breaks invoices. Legacy presets (classic/slate/navyGold/forest) are converted on read to a Custom theme keeping their stored colors (`normalizeInvoiceTheme` in `lib/invoices/theme.ts`).
- **Full-screen preview:** Expand button opens `DocumentPreviewDialog` (dark scrim, A4 scaled to viewport height, Esc, focus trap, focus returns to Expand).

## Key files
- `lib/bookings/import-normalize.ts` (dates), `lib/bookings/import-mapping.ts` (mapping, notes, combine)
- `app/(app)/bookings/` import-sheet, import-column-mapping, bookings-export-dialog, invoice-theme-dialog
- `components/ui/sheet-resize.tsx`, `components/ui/select.tsx`
- `lib/invoices/theme.ts` (`resolveInvoiceTheme`), `lib/invoices/pdfShared.tsx`, `lib/validators/invoiceTheme.ts`
- `app/api/bookings/[id]/{invoice,receipt}/route.ts`, `lib/db/models/Workspace.ts`
- E2E: `e2e/bookings-import-mapping.spec.ts`

## Gotchas
- Consumers of `useSheetResize` must use `!` on width and max-width. The base sheet's `data-[side=right]:sm:max-w-sm` attribute selector outranks plain overrides.
- Base UI nested dialogs skip their Backdrop unless `forceRender` is set (needed for the full-screen preview over a sheet).
- `"source" in assignment` misses `{ sources }`. Use `assignmentSources`.
- The import route and `bookingImportRowSchema` stay strict. Leniency happens client-side in `applyMapping`, so the server boundary is unchanged.
- Date order default is per timezone (`MDY` for `Asia/Manila` and `America/*`, else `DMY`). It is swapped only when the column is ambiguous.
- The seed workspace vocabulary renders %booking% as "appointment", so e2e button text reads "Import 3 appointment(s)". Assert `/^Import 3 /`.
