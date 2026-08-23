# Comparison page screenshot work order

Self-contained brief for whoever captures the images for the individual comparisons and pillar pages. Nothing here
depends on the SEO branch's code — the app as it stands today has every screen listed.

Load the `run-gallurio` skill for booting the app and signing in as the seeded owner, and
`portfolio-testing` for the editor-specific locators and the canvas iframe. Use the Playwright CLI,
not the MCP plugin.

Folds into `docs/marketing/seo-handoff.md` once the shots are captured; it is a work order, not a
permanent reference.

---

## Capture rules

- **Output:** `public/marketing/editorial/<shot-id>.png`. Shot ids are given below and are stable —
  the MDX frontmatter references them by id.
- **Viewports:** `1280x800` for every desktop shot, `375x812` for every shot marked *(mobile)*.
  Device scale factor **2** on all of them.
- **Theme:** light. The marketing surface is light-dominant; a dark screenshot will read as a
  different product.
- **Chrome:** no browser chrome, no URL bar. `page.screenshot()` on the element or a full-viewport
  clip, never a full-page scroll capture — tall stitched images are unreadable at article width.
- **Data:** the seeded dev workspace. Before capturing, confirm no real client names, emails, or
  phone numbers are visible; the seed data is fictional, but a manually-created record may not be.
  Redact nothing in post — fix the data and re-shoot, so the image stays honest.
- **Do not consume seed accounts.** Stop short of terminal steps (final onboarding submit,
  subscription checkout). Every shot below is reachable without them.
- **State:** populated, never loading or empty, unless the shot id says otherwise.

## Image SEO requirements

These are the reason the shots exist at all — they need to be crawlable, not just present.

- Every image gets a specific `alt` describing what is *shown*, not the filename. "Gallurio booking
  detail with a paid invoice and the client's contact record" — not "screenshot" or
  "Gallurio dashboard".
- Intrinsic `width`/`height` on every one, so nothing shifts during load (CLS).
- Serve through `next/image` so WebP/AVIF conversion and responsive `srcset` come for free.
- Captions are real text under the image, not baked into the PNG. Text inside a raster is invisible
  to both crawlers and screen readers.
- Filenames are descriptive and hyphenated — they are a weak ranking signal and a free one.

---

## Shared shots

Used across most or all ten pages. Capture once.

| Shot id | Title | What must be on screen |
|---|---|---|
| `dashboard-overview` | Workspace dashboard with revenue and upcoming bookings | Metric cards populated with non-zero figures, the revenue chart with several months of data, upcoming-bookings list with at least three entries |
| `bookings-list` | Bookings list with mixed statuses | At least six bookings spanning inquiry / confirmed / completed, so the status column reads as a pipeline |
| `booking-detail-invoice` | Booking detail showing the linked invoice and client | Single booking open, invoice section visible with a total, client name and contact panel in frame |
| `calendar-month` | Month calendar with bookings across several days | A month with bookings on at least five different days, ideally two on one day so overlap is visible |
| `client-record` | Client record with booking history and total spent | One client, their contact details, and a history list of two or more past bookings |
| `inquiries-inbox` | Inquiry inbox with unread and converted inquiries | Mixed read/unread state, at least one showing it became a booking |
| `invoice-pdf` | Generated invoice PDF | The rendered PDF itself, not the dialog. Branded, with line items and a total |
| `pricing-local` | Pricing page showing the localized price estimate | The Pro card with the local-currency headline and `billed as $X` note visible. Capture from a non-USD geo context such as AE so the note renders |

## Portfolio and public-page shots

| Shot id | Title | What must be on screen |
|---|---|---|
| `editor-canvas` | Portfolio editor with the block library open | The Puck canvas with a real multi-block page, block library panel open on the side |
| `editor-drag` | Dragging a block into the portfolio canvas | Mid-drag, with the drop indicator visible. This is the "drag and drop" proof for the site-builder comparisons |
| `editor-theme-panel` | Brand kit panel with colors and fonts | Theme panel open, the five brand colors and font pickers visible |
| `public-page-desktop` | Published portfolio home page | The live `/w/<slug>` page, fully rendered, branded |
| `public-page-mobile` | Published portfolio on a phone *(mobile)* | Same page at 375px, showing it is genuinely mobile-first |
| `public-gallery` | Published gallery page | Populated image grid, not a placeholder |
| `public-contact-form` | Contact form on the published page | The inquiry form with fields visible, unsubmitted |

## Sequence shots

Three frames telling one story. Used on the Google Forms and spreadsheet comparisons, where the
argument is about what happens *after* someone fills in a form.

| Shot id | Title | What must be on screen |
|---|---|---|
| `flow-1-inquiry-submitted` | Step 1: a visitor submits the inquiry form | The public contact form filled in, before submit |
| `flow-2-inquiry-received` | Step 2: the inquiry arrives in the inbox | The same inquiry visible in the inquiries list, unread |
| `flow-3-client-and-booking` | Step 3: the client record and booking created from it | The client record that inquiry produced, with its booking linked |

Capture this sequence **once**, on a throwaway inquiry, and reuse the frames. Do not re-submit to
re-shoot a single frame — it writes to the shared dev DB each time.

---

## Per-page assignment

| Comparison page | Shots |
|---|---|
| `gallurio-vs-honeybook` | `dashboard-overview`, `bookings-list`, `booking-detail-invoice`, `invoice-pdf` |
| `gallurio-vs-dubsado` | `bookings-list`, `booking-detail-invoice`, `inquiries-inbox`, `client-record` |
| `gallurio-vs-studio-ninja` | `dashboard-overview`, `calendar-month`, `booking-detail-invoice` |
| `gallurio-vs-17hats` | `dashboard-overview`, `inquiries-inbox`, `invoice-pdf`, `client-record` |
| `gallurio-vs-squarespace` | `editor-canvas`, `editor-drag`, `public-page-desktop`, `public-page-mobile`, `bookings-list` |
| `gallurio-vs-wix` | `editor-canvas`, `editor-theme-panel`, `public-page-desktop`, `inquiries-inbox` |
| `gallurio-vs-pixieset` | `public-gallery`, `public-page-desktop`, `booking-detail-invoice`, `client-record` |
| `gallurio-vs-notion` | `dashboard-overview`, `calendar-month`, `client-record`, `invoice-pdf` |
| `gallurio-vs-google-sheets` | `bookings-list`, `dashboard-overview`, `invoice-pdf` |
| `gallurio-vs-google-forms-and-email` | `flow-1-inquiry-submitted`, `flow-2-inquiry-received`, `flow-3-client-and-booking`, `public-contact-form` |

The site-builder and gallery pages lean on `editor-*` and `public-*` because the argument there is
"your website already does the selling — it should also do the booking." The CRM pages lean on
`bookings-*` and `invoice-*` because the argument is focused feature parity with regional pricing.

---

## Competitor pricing screenshots — do not publish these

Worth being direct, because the request was to include them and the answer is a qualified no.

Publishing a screenshot of a competitor's pricing page reproduces their copyrighted page design and
displays their trademarks on our commercial marketing site. Comparative advertising law protects
**factual claims** about a competitor's price — it does not cover wholesale reproduction of their
page. It is also the single most likely thing on these pages to draw a takedown, and a takedown on
a page that is ranking is a bad trade for an image nobody scrolls to.

The defensible pattern, which is also what the serious comparison sites do:

1. State the competitor's price as **text in our own table**, in our own styling.
2. Cite the source URL and a `checkedOn` date in the frontmatter, rendered as a visible footnote.
3. Link the citation to a **web.archive.org snapshot** of their pricing page on that date. That is
   the evidence, it is durable, and it costs us nothing legally.
4. Capture a screenshot for **internal records only** if you want a local archive — into
   `docs/marketing/_evidence/` (gitignored), never into `public/`, never rendered on a page.

So: capture them if it helps you verify the numbers, keep them out of the repo's public tree, and
let the archive link do the public work.

---

## Handoff back

When done, report: the shot ids captured, any that could not be produced from seed data and why,
and the actual pixel dimensions of each file. The MDX frontmatter references shot ids, so a missing
id is a broken page, not a missing image.
