# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Owners and small teams at event businesses (photographers, planners, coordinators) — not enterprise-software people. They run their whole client-facing operation through the app: tracking bookings, managing client records, scheduling on the calendar, curating a gallery, and publishing a public portfolio that captures inquiries. Usage is fragmented across a real workday — triaging on a phone between shoots, then working from a desktop at the studio — so mobile and desktop both carry real workflows, not a stripped-down mobile afterthought.

## Product Purpose

Gallurio is a multi-tenant CRM SaaS that gives event businesses one polished, reliable tool to run bookings, clients, calendar, gallery, and their public-facing portfolio — replacing a patchwork of spreadsheets, DMs, and generic scheduling tools. Success looks like an owner trusting the tool enough to run their whole client pipeline through it, from first inquiry to booked event.

## Positioning

Gallurio owns both halves of the same job in one workspace: the public portfolio that *generates* the inquiry, and the bookings, clients, calendar, and gallery that *handle* it afterwards. Because both live in the same tenant, a public inquiry becomes an Inquiry, a Client, and a Booking in a single transaction - no export, no re-keying, no second tool.

Neighboring products own one half only, and their comparison pages state this plainly rather than claiming a clean sweep:
- CRM-first tools (HoneyBook, Dubsado, 17hats, Studio Ninja) manage what happens after the inquiry, but do not give the business its public portfolio.
- Site and gallery tools (Squarespace, Wix, Pixieset) publish the page, but stop at the inquiry - bookings, clients, and payments live elsewhere.
- Spreadsheets and generic tools (Google Sheets, Google Forms, Notion) do neither properly and break down as volume grows.

## Operating Context

- The workday is fragmented and mobile-heavy: owners triage inquiries and check the day's schedule on a phone between shoots, then do heavier work (portfolio editing, invoicing, team assignment) at a desktop. Both are real workflows, not one mirrored down.
- The inquiry-to-booking path is the spine of the product: a visitor submits the public contact form at `/w/<orgSlug>` -> the workspace receives an inquiry -> it converts to a Client plus a Booking with sessions, location, amount, and payments.
- Work is often collaborative: workspaces have teams and roles (member/lead), staff get assigned to bookings, and in-app notifications plus transactional email carry the handoffs.
- Money is tracked inside the tool: per-booking totals, deposits, a payments journal (cash/card/remit), per-client transaction history, and generated invoice PDFs with sequential per-workspace numbering.
- The public portfolio is edited live in a drag-and-drop builder and published to three public pages (Home, Gallery, Contact) under the workspace's own slug.

## Capabilities and Constraints

**Confirmed capabilities**
- Multi-tenant workspaces (bookings, clients, calendar, inquiries, galleries, teams, notifications, activity log, invoices).
- No-code portfolio builder with themes/brand kits, drafts and versioning, and a public site at `/w/<orgSlug>`.
- Public inquiry capture that lands as a single Inquiry + Client + Booking transaction.
- Five locales - `en`, `fil`, `id`, `ar` (RTL), `th` - with the public portfolio's language owner-controlled and isolated from the CRM's own locale.
- Light and dark themes across every surface.

**Constraints future work must respect**
- Tenancy is absolute: every tenant-scoped read and write is bound to `workspaceId`, resolved from the session and a re-validated active-workspace cookie - never from client input. No surface may leak or imply cross-tenant data.
- Plans are `free | pro | beta` only. There is no Starter tier and no permanent free tier.
- Lifecycle: one month of free Pro on signup (no card), then a hard gate to `/subscribe`. A lapse never deletes CRM data - only the public page eventually goes offline, and republishes intact on resubscription.
- Lemon Squeezy is the implemented provider and merchant of record; paid checkout is gated behind `PAID_BILLING_ENABLED`. Do not present any other provider as integrated.
- Identity is WorkOS AuthKit only; workspaces are the product's own records, not WorkOS Organizations.
- Terminology is fixed and user-facing: workspace, inquiry, booking (with sessions), client, team, gallery, portfolio.
- Platform is web (mobile web included). No native app design language applies.

**Explicitly undecided**
- Which payment provider ultimately activates live payments (Lemon Squeezy is implemented; Creem and a sole-proprietor Paddle application remain candidates).
- Final public pricing figures and launch date.

## Brand Personality

Polished, premium, refined. The app should feel like a serious, well-made tool worth paying for — precise and considered, not flashy. Warmth comes through craft and clarity, not decoration.

## Anti-references

- Generic SaaS-cream dashboards: gradient hero-metric cards, glassmorphism, cream/sand backgrounds, same-sized icon+heading+text card grids — the current AI-tool default look.
- Sterile enterprise/legacy-ERP software: cold, dense, corporate.
- Cluttered UI: too many cards, badges, and competing accents fighting for attention at once.

## Brand Commitments

- Name and voice: "Gallurio", used in full. The marketing voice is plain, concrete, and non-hyped - it states trade-offs openly ("None of these pretend Gallurio wins on every point") and avoids growth-marketing superlatives. Keep that register.
- Logo assets exist and are binding: `public/brand/gallurio-rect.svg`, `gallurio-sq.svg`, plus white and PNG variants. Do not invent a new mark.
- Product line: "portfolio and booking software for event creatives." The audience is named concretely - photographers, videographers, wedding and event planners, makeup artists, stylists, caterers, entertainers/DJs, creative studios.
- Transparency is a brand commitment, not decoration: free month with no card, one plan with terms shown before checkout, Lemon Squeezy named as merchant of record, and an explicit "software, not services" statement. These claims appear on the marketing surface and must stay accurate.
- Design authority: `DESIGN.md` ("The Studio Ledger") owns the visual world. This file does not.

## Evidence on Hand

Gallurio is pre-launch. **No customers, testimonials, logos, reviews, ratings, usage metrics, or case studies exist.** Never fabricate them, and never add a placeholder testimonial or "trusted by" row intending to fill it later.

What is real and usable as proof:
- Product screenshots, light and dark: `public/marketing/screenshots/` (dashboard, bookings calendar, portfolio builder canvas, teams).
- Editorial/flow imagery: `public/marketing/editorial/` (inquiry submitted -> received -> client and booking, invoice detail, client record, inquiries inbox, theme panel).
- A live, interactive portfolio-builder demo at `/portfolio-maker-demo`, and a "Book a demo" path.
- Honest comparison pages against the tools people actually switch from (`/compare/<slug>`), which state where Gallurio loses.
- Verifiable third-party facts: Lemon Squeezy as merchant of record; WorkOS for authentication.

The product itself is the proof. Persuasion comes from showing the real interface and the real inquiry-to-booking path, not from borrowed social proof.

## Design Principles

- **Craft signals trust.** Event businesses charge premium prices to their own clients; the tool running their business should look and feel like it, not like a generic dashboard template.
- **Calm efficiency over decoration.** Every screen serves a real workflow (bookings, calendar, clients). Polish comes from restraint and precision, not ornament.
- **One accent, used deliberately.** Brand teal marks action and status; the rest of the interface stays quiet so the accent still means something.
- **Consistent across a fragmented day.** Owners move between phone and desktop mid-workflow — parity in density and capability matters, not just a scaled-down mobile view.
- **Tenant trust by default.** Every surface reinforces workspace isolation — no visual or functional leakage between tenants, ever.

## Accessibility & Inclusion

WCAG AA target: 4.5:1 body text contrast, full keyboard support, semantic HTML, color never the sole signal. Five locales (`en`, `fil`, `id`, `ar`, `th`) — Arabic is RTL and uses logical CSS/Tailwind properties, not physical ones.
