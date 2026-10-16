# Bookings import: manual test guide

Branch: `fix/import-bookings-feature` (QA baseline `04867504`; fixes in this working tree).
Test files: `qa/bookings-import/files/`. This folder is committed for manual testing only; remove it before the PR merges.

All test data is tagged: titles start with `QA-IMP` and client names start with `QA `. That way cleanup only removes test rows (see the end of this guide).

## Setup
1. Run `pnpm dev` and sign in as the seeded owner.
2. Go to Bookings and open **Import**.
3. Test at 1280px. Repeat the review-table checks at 375px (DevTools device mode).
4. Keep DevTools open on the Network tab for the performance and API checks.

## 1. Files that should import

| File | Case | Expected |
|---|---|---|
| `01-happy-template.csv` | Our own template headers | Skips the mapping step and goes straight to the preview with 5 valid rows. Import closes the sheet and shows a success toast. The 5 bookings appear in the list with no page reload. |
| `01-happy-template.csv` (upload again) | Re-import of the same file | Shows an **"Already imported?"** dialog before anything is written. Cancelling writes nothing. |
| `02-foreign-crm.xlsx` | Another CRM's export: "Customer", "Event Date", ₱ number format, a formula | Auto-maps: "Event Date" → start date (not title), "Package Price" → total. Dates read **Jun 11–14, 2031** with no day shift. |
| `03-semicolon.csv` | European Excel CSV that uses `;` | Columns split correctly (4 columns, not 1). |
| `04-ansi-1252.csv` | Windows "CSV" encoding (not UTF-8) | The client name reads **José Peña**, not `Jos� Pe�a`. |
| `05-utf8-bom.csv` | UTF-8 BOM, Thai, Arabic, emoji | The first header is "Title" (no hidden BOM character). สมชาย ใจดี, محمد العلي and Zoë 👰‍♀️ render intact. |
| `11-title-rows.xlsx` | A banner row and a blank row above the header | Skips the banner and finds the Title/Client/Date header on row 3. |
| `12-multi-sheet.xlsx` | Instructions tab first, data on the 2nd tab | Uses the "Data" tab: 1 row, "QA-IMP Tab2". |
| `19-wide-60cols.csv` | 60 columns with very long header names | The mapping and preview layout doesn't break or push the sheet wider than the screen. |
| `20-multi-session.csv` | 3 rows sharing `booking_id` `qa-wed-1` | Becomes **1 booking with 3 sessions** (Oct 1–3, 2031), not 3 bookings. |

## 2. Mixed good and bad rows

`13-bad-values.csv` has 15 data rows, each one a different problem. In my run, 11 imported and the rest were skipped with a reason. Check that:
- Every skipped row has a reason you can understand. The empty-client row now names the missing client name.
- `TBD` as a date is flagged, not imported as "today".
- End before start is flagged. The 22:00 → 02:00 row currently skips because booking sessions must stay within one workspace day; see the findings report for the expectation mismatch.
- Deposit greater than total, a negative total, currency `XYZ`, status `Maybe?` and email `bad@` are each either flagged or handled sensibly.
- The 160-character title with an emoji at the end is trimmed cleanly (no broken `�` character).
- The `=HYPERLINK(...)` title and `@SUM` note import as plain text. If you export bookings afterwards and open the file in Excel, nothing should run as a formula.
- The note with a line break keeps its line break. The 3,000-character note doesn't stretch the table.
- The rows with extra columns and with too few columns don't shift values into the wrong columns.
- At **375px**: rows use compact cards, with the reason under the title and the start date on its own line. The sheet should have no sideways overflow.

## 3. Files that should be refused, each with a clear message

| File | Expected message |
|---|---|
| `06-empty.csv` | "This file is empty." |
| `07-header-only.csv` | "We found column headers but no rows under them." |
| `08-png-renamed.csv` | "This doesn't look like a CSV file. Choose a .csv or .xlsx spreadsheet." |
| `14-rows-600.csv` | "This file has 600 rows. Import up to 500 at a time — split it into smaller files." |
| `15-rows-600.xlsx` | The same 600-row message. |
| `16-big-3mb.xlsx` | "This file is larger than the 2 MB limit. Split it into smaller files." |
| `17-big-8mb.csv` | The same 2 MB message, shown right away. The tab should not freeze. |
| `09-old-excel.xls` | "This is an older Excel file. Save it as .xlsx and try again." |
| `10-corrupt.xlsx` | The generic "Could not read this file…". |

After each refusal, check that you can choose another file without closing the sheet.

## 4. Server-side failures

`21-server-errors.csv` has 3 rows. Expect 1 import and 2 failures listed in the results dialog:
- The row with an unknown `booking_id` fails.
- The "completed" row that isn't fully paid fails.

The results dialog should show localized explanations for an unknown booking ID and an unpaid completed booking, using the workspace's booking term.

## 5. Large file and performance

`18-rows-500.csv` has exactly 500 rows, the maximum allowed.
- The preview should appear within a few seconds.
- The 500-row commit took about 94 seconds in the October 2026 development QA run after bounded parallel writes. It remains a long wait; measure it again against the target deployment before release.
- In the Network tab, an import should make one `POST` commit request and then **a single** `GET /bookings` refresh, not a burst of requests.
- Previews have their own rate limit (30 per 5 minutes) and commits have theirs (10 per 5 minutes). If you hit one, the message should say how many seconds to wait.

## 6. Network errors (DevTools)
- Set DevTools → Network to **Offline**, then upload an `.xlsx` file. Expect "Couldn't upload the file. Check your connection and try again."
- Set it to Offline right after clicking Import on a CSV. You should get a readable error, not a stuck spinner.

## 7. Other things in this branch
- **Sheet resize grip:** on the Import, Export and Invoice theme sheets, the left edge shows a small pill with 3 dots. It turns teal on hover or drag. Check it in light and dark mode. It's hidden at 375px.
- **404 pages:** open `/qa-nope`, `/en/qa-nope` and `/w/qa-no-such-workspace`. Each shows the 404 page, and the console has no hydration error.
- **Invoice theme:**
  - A workspace with no saved theme shows the classic dark palette.
  - "Match portfolio" fails clearly when the portfolio isn't published.

## Cleanup (dev DB)
Run this from the repo root after testing:
```
node qa/bookings-import/cleanup-import-qa.js . --show     # list what would be deleted
node qa/bookings-import/cleanup-import-qa.js . --apply    # delete it
```
It removes bookings titled `QA-IMP…` or with a client named `QA …`, plus their transactions, activity logs and imported clients. The four encoding-fixture names are allowed only when their clients came from import. It refuses to run if a matched booking points at another client or a client is also linked to a non-QA booking.

To regenerate fresh files (new unique emails), run:
`node qa/bookings-import/gen-import-qa.js . qa/bookings-import/files`. You don't need to; the files that are there now are fresh, and the dev DB currently has 0 QA rows.
