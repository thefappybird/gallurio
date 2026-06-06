# EventCRM — SaaS Blueprint for an Events Management CRM Platform

**One-month MVP plan · Solo founder / small team · Next.js + MongoDB**

This document is the working blueprint: product scope, architecture, schema, roadmap, pricing, GTM, and risks — all opinionated for speed. Where a "best" answer doesn't exist for a 1-month MVP, I pick one and explain the tradeoff.

---

## 0. North-Star Decisions (read this first)

If you only remember six things from this document:

1. **One Next.js app, App Router, monolith.** No separate backend service. No microservices. You'll regret splitting before you have customers.
2. **Multi-tenant via shared DB + `orgId` on every document.** Not schema-per-tenant, not DB-per-tenant.
3. **Clerk for auth + orgs.** Don't roll your own. Auth is 2 weeks of work you cannot afford.
4. **MongoDB Atlas + Mongoose.** Stop bikeshedding the ORM debate.
5. **Cloudinary for image storage.** Browser-direct signed uploads, on-the-fly transformations (`f_auto,q_auto`, thumbnails), built-in CDN — critical for a gallery-heavy product. (Earlier draft had Cloudflare R2; Cloudinary won for the transform pipeline and the zero-infrastructure thumbnailing.)
6. **Ship one vertical first.** Pick *wedding photographers* or *venues*, not "all event businesses." You can broaden after 50 paying customers.

---

## 1. Product Scope (MVP First)

### MVP — must ship in 4 weeks

| Feature | Why it's in MVP |
|---|---|
| Business owner signup + workspace creation | Entry point |
| Client/contact management (CRUD) | Core CRM |
| Bookings / events (create, edit, status: inquiry → booked → completed → cancelled) | The core noun |
| Calendar view (month + week) | Visual must-have, common churn-saver |
| Public inquiry form per workspace | Drives the "first $$$" use case |
| Lead → client conversion flow | The wedge into a CRM purchase |
| Simple public landing page per workspace (1 template, edit text/images/contact) | Differentiator vs Notion/spreadsheets |
| Image upload to galleries (drag, reorder, delete) | Required for photographers/venues/stylists |
| HitPay subscription billing (Free + 2 paid tiers; PHP, card-only — GCash unavailable for recurring) | You need revenue from day 1 |
| Email notifications: new inquiry, booking confirmed (Resend) | Trust + retention |
| Basic dashboard (today's events, recent inquiries, upcoming, revenue this month) | First-screen value |

### Postpone (v1.1, weeks 5–8)

- Staff/team member roles within a workspace
- Drag-and-drop page builder (use 1 template + editable blocks for MVP)
- Invoicing PDF generation
- Contract templates + e-signature
- Custom domains
- WhatsApp notifications
- SMS reminders

### Nice-to-have (v1.2+)

- QR check-in for events
- Client portal (clients log in to see their booking)
- Mobile app
- Workflow automation (Zapier-like)
- Multi-language
- Analytics dashboards beyond basic counts

### Cut entirely (or don't even prototype this month)

- AI assistants / chatbots
- Marketplace / discovery directory
- **Marketplace payments** (tenants accepting end-client payments via Gallurio-managed sub-accounts) — dropped during the HitPay swap; tenants can collect end-client payments via their own HitPay/GCash accounts out-of-band for MVP
- Internal team chat
- Resource scheduling (rooms, equipment)
- Multi-currency accounting
- Vendor-to-vendor referrals
- White-labeling

**Rule of thumb:** if a feature requires a third async system (queue, worker, cron), defer it.

---

## 2. User Roles & Permissions

| Role | Scope | Permissions |
|---|---|---|
| **Super Admin** (you) | Platform-wide | View all orgs, impersonate, suspend, refund, view metrics. Built as a separate `/admin` route gated by Clerk role + IP allowlist. |
| **Business Owner** | Their org | Full CRUD on their org's bookings, clients, gallery, page builder, billing, integrations. Manage invites. |
| **Staff / Team Member** *(v1.1)* | Their org | CRUD on bookings + clients. Cannot edit billing, public page, or invite users. |
| **Public Client / Lead** | Unauthenticated | Submit inquiry forms. View the public landing page. (No login in MVP.) |

**Implementation:** use Clerk Organizations. Each `org` in Clerk maps 1:1 to a `Workspace` in MongoDB. Permissions checked in a single middleware that resolves `req.user`, `req.org`, `req.role` before any handler runs.

---

## 3. SaaS Architecture

### Monolith vs separated backend

**Monolith.** One Next.js 14+ app with App Router. API routes in `app/api/*`. Server Components for data fetching where possible, Route Handlers for mutations and webhooks. Reasons:

- One deploy target, one log stream, one env file.
- Vercel preview URLs Just Work for every PR.
- No CORS, no cross-service auth, no service discovery.
- You can extract a service later if a specific endpoint actually needs it. You probably never will.

### Is MongoDB enough for scaling initially?

Yes — comfortably to the first 10k orgs / millions of bookings. Use Atlas M10 → M30 as you grow. Switch only if you hit real relational pain (complex multi-table aggregations on financial data). For this product, the data is fundamentally document-shaped: a booking owns its line items, notes, attachments. Mongo is a fit.

### ORM/ODM

**Mongoose.** Battle-tested, type-safe with `zod` validation on top, good middleware story for soft-delete and `orgId` enforcement. Prisma + Mongo is still missing features you'll want (transactions, change streams). Skip Prisma here.

### Auth provider

**Clerk.** Reasons:
- Multi-tenant Organizations are built in (the killer feature for this product).
- Drop-in `<SignIn />`, `<OrganizationSwitcher />` components.
- Social logins, MFA, magic links, all included.
- Free up to 10,000 MAU.

Alternatives:
- **Auth.js (NextAuth)** — free forever but you'll build org logic yourself (3–5 days).
- **Supabase Auth** — fine, but you'd add a second platform.

### Folder structure

```
app/
  (marketing)/                 # public landing, pricing, blog
  (auth)/                      # sign-in, sign-up (Clerk)
  (app)/
    [orgSlug]/
      dashboard/
      bookings/
      clients/
      calendar/
      gallery/
      page-builder/
      settings/
        billing/
        team/
        integrations/
  (public)/
    [orgSlug]/                 # the public landing page route
      page.tsx
      inquire/
        page.tsx               # public inquiry form
  api/
    bookings/route.ts
    clients/route.ts
    inquiries/route.ts
    uploads/sign/route.ts      # presigned R2 URLs
    webhooks/
      stripe/route.ts
      clerk/route.ts
  admin/                       # super-admin
lib/
  db/
    mongoose.ts
    models/
      Workspace.ts
      User.ts
      Booking.ts
      Client.ts
      ...
  auth/
    requireOrg.ts
    requireRole.ts
  storage/
    r2.ts
  email/
    resend.ts
    templates/
  validators/                  # zod schemas mirroring Mongoose models
components/
  ui/                          # shadcn primitives
  bookings/
  calendar/
  page-builder/
hooks/
middleware.ts                  # Clerk middleware + tenant resolution
```

### API structure

REST-ish via Route Handlers. Routes are tenant-scoped through the URL: `/api/bookings` reads `orgId` from the active Clerk session, never from the body. Server Actions for form mutations inside the app to skip a network hop. Webhooks live under `/api/webhooks/*` with raw-body parsing.

### Authentication flow

```
User visits /sign-in
  → Clerk hosted UI (or embedded component)
  → On success, redirected to /[orgSlug]/dashboard
  → Middleware:
       - resolves Clerk userId
       - resolves active org (Clerk session)
       - rewrites context: { userId, orgId, role }
  → Every DB query is wrapped in withOrg(orgId) helper
```

### Image storage

**Cloudinary** (free tier in dev → Programmable Media plan in prod). Flow:

1. Browser asks `/api/uploads/sign` for an upload signature. The route calls `requireOrg()` and pins the upload `folder` to `gallurio/{workspaceId}/...` so a client can't aim uploads at another tenant.
2. Browser POSTs the file directly to `https://api.cloudinary.com/v1_1/{cloud_name}/auto/upload` with the signature, timestamp, and api key — server never sees the file bytes.
3. On success, browser POSTs `{ secure_url, public_id, width, height, bytes, format }` to `/api/gallery/items`.
4. Display thumbnails by deriving transformed URLs from the `public_id` (`c_fill,w_400,h_400,q_auto,f_auto`) — no extra storage, no extra request.

Use `next/image` with the Cloudinary `secure_url` as `src`, or pass a transformed URL directly. Delete-on-remove: server calls `cloudinary.uploader.destroy(public_id)` when a Mongo doc referencing the asset is deleted.

### Public gallery routing

Two strategies, pick **subdirectory first**:

- **Subdirectory** (MVP): `app.yourdomain.com/[orgSlug]` — public landing page.
- **Custom domain** (v1.1): map `studio.example.com` via Vercel domain API + verify with TXT record. Wildcard SSL via Vercel.

The public route is a separate route group `(public)` that does **not** require auth and uses ISR with `revalidate: 60` so edits propagate within a minute.

---

## 4. Database Design

All documents include `orgId` (indexed) + `createdAt` + `updatedAt`. All non-shared collections enforce `orgId` in every query via a Mongoose plugin that intercepts `find`, `findOne`, `update*`, `delete*`.

### Collections

```ts
// workspaces (one per business)
{
  _id, slug,                       // slug is unique, used in URLs
  name, ownerUserId,
  publicPage: {
    templateId,                                  // one of 5: wedding-photographer | event-photographer | planner | venue-stylist | minimal
    data: { home: PuckData | null, gallery: PuckData | null },
    brandKit: { themePreset, fontPair, primaryColor, secondaryColor, accentColor, backgroundColor, foregroundColor, radius, buttonStyle },
    publishedAt, lastPublishedAt, latestVersion,
    seoTitle, seoDescription, inquiryRecipientEmail,
  },
  branding: { logoUrl, primaryColor, description },
  customDomain,                    // null until v1.1
  plan: "free" | "starter" | "pro",
  stripeCustomerId, stripeSubscriptionId,
  trialEndsAt, createdAt
}

// users (mirror of Clerk users — denormalized for joins)
{
  _id, clerkUserId, email, name, avatarUrl,
  memberships: [{ orgId, role: "owner"|"staff" }],
  createdAt
}

// clients
{
  _id, orgId,
  name, email, phone,
  tags: [String],
  source: "form" | "manual" | "referral",
  totalSpent, lastBookingAt,
  notes,                           // markdown
  createdAt, updatedAt
}

// bookings (the core noun)
{
  _id, orgId,
  clientId,                        // ref clients
  title,                           // "Sarah & Mark Wedding"
  eventType,                       // "wedding" | "corporate" | ...
  status: "inquiry"|"booked"|"completed"|"cancelled",
  // inquiry   = created from an inquiry form; a new, unconfirmed lead
  // booked    = owner approved/confirmed; appears in calendar as a confirmed booking
  // completed / cancelled = terminal states
  startAt, endAt,
  location: { address, lat, lng },
  amount: { total, deposit, currency },
  createdFromInquiryId: ObjectId|null,
  staffIds: [ObjectId],            // v1.1
  notes,
  customFields: { ... },           // org-defined
  createdAt, updatedAt
}

// transactions
{
  _id, orgId, bookingId, clientId,
  amount, currency,
  type: "deposit"|"balance"|"refund"|"other",
  method: "stripe"|"cash"|"transfer"|"other",
  stripePaymentIntentId,
  paidAt, createdAt
}

// invoices (v1.1)
{
  _id, orgId, bookingId, clientId, number,
  lineItems: [{ desc, qty, unitPrice }],
  total, status: "draft"|"sent"|"paid"|"overdue",
  dueAt, pdfUrl, createdAt
}

// galleryItems
{
  _id, orgId,
  collectionId,                    // optional grouping
  url,                             // Cloudinary secure_url
  cloudinaryPublicId,              // Cloudinary public_id (source of truth for transforms + delete)
  width, height, sizeBytes, format,
  caption, altText, order, tags,
  createdAt
}

// galleryCollections
{
  _id, orgId, name, slug, coverItemId,
  isPublic, order, createdAt
}

// publicPageBlocks (embedded in workspaces, but if it grows, split here)
// — keep embedded for MVP (avg < 50 blocks)

// inquiries (form submissions before they become clients)
{
  _id, orgId,
  name, email, phone, message,
  eventDate, eventType, budgetRange,
  source,                          // utm_source, referrer
  status: "new"|"contacted"|"converted"|"archived",
  convertedClientId, convertedBookingId,
  createdAt
}

// activityLogs (audit trail)
{
  _id, orgId, actorUserId,
  entity: "booking"|"client"|"...",
  entityId, action: "created"|"updated"|"deleted"|"status_changed",
  diff,                            // before/after snippet
  createdAt
}

// notifications (optional MVP)
{
  _id, orgId, userId, type, payload, readAt, createdAt
}
```

### Indexing

| Collection | Indexes |
|---|---|
| `workspaces` | `{ slug: 1 }` unique, `{ ownerUserId: 1 }`, `{ customDomain: 1 }` sparse unique |
| `clients` | `{ orgId: 1, name: 1 }`, `{ orgId: 1, email: 1 }`, `{ orgId: 1, createdAt: -1 }` |
| `bookings` | `{ orgId: 1, startAt: 1 }`, `{ orgId: 1, status: 1, startAt: 1 }`, `{ orgId: 1, clientId: 1 }` |
| `transactions` | `{ orgId: 1, bookingId: 1 }`, `{ orgId: 1, paidAt: -1 }` |
| `galleryItems` | `{ orgId: 1, collectionId: 1, order: 1 }` |
| `inquiries` | `{ orgId: 1, status: 1, createdAt: -1 }` |
| `activityLogs` | `{ orgId: 1, entity: 1, entityId: 1, createdAt: -1 }`, TTL index after 1 year |
| `users` | `{ clerkUserId: 1 }` unique, `{ email: 1 }` |

**Critical rule:** every compound index leads with `orgId`. Without it, list queries scan the whole collection across all tenants.

### Relationships

Mongo doesn't enforce them — you do, in Mongoose `pre('save')` hooks and in the orgId middleware. Use refs (ObjectId) and `.populate()` sparingly; prefer denormalization when read-heavy (e.g., `client.name` cached on `booking.clientName` for list views).

---

## 5. UI/UX Planning

### Dashboard layout

Three-column on desktop, stack on mobile:

```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar │  Main content                       │  Right rail │
│  (240px) │  (fluid)                            │  (320px,    │
│          │                                     │   collapsible)│
└─────────────────────────────────────────────────────────────┘
```

- **Sidebar**: workspace switcher (Clerk OrgSwitcher), Dashboard, Bookings, Calendar, Clients, Inquiries, Gallery, Public Page, Settings.
- **Main**: cards — Today's events, Pipeline (Inquiries → Booked), Upcoming this week, MRR/Revenue this month.
- **Right rail**: recent activity feed, quick-add button (booking/client/inquiry).

### Onboarding flow (target: <3 minutes to first value)

1. Sign up via Clerk (email + Google).
2. **Create workspace**: business name + slug (auto from name) + business type (preset for industry templates).
3. **Branding step**: logo, primary/secondary color, tagline, description.
4. **Plan step**: free / starter / pro (HitPay checkout for paid plans).
5. **Sample data toggle**: "Start with sample bookings/clients to explore" (deleteable in one click).
6. Land on dashboard with a 4-step checklist: add first client → create first booking → publish public page → connect Stripe.

Picking a portfolio template happens **later** in the dedicated first-visit page-builder wizard (`/page-builder/wizard`) — not during onboarding — so onboarding stays under 3 minutes.

The checklist is the entire activation funnel. Track each step as a property in Clerk publicMetadata so you can email on stalls.

### Booking management UI

Two views, toggleable:

- **List view**: filterable table with status chips, columns sortable. Inline edit for status + date.
- **Kanban view**: columns = statuses, cards draggable. Great demo footage.

Booking detail = drawer (not full-page nav) for quick edits, plus a "/bookings/:id" deep link.

### Drag-and-drop page builder UX

Built on **Puck (`@measured/puck`)** — a React drag-and-drop editor with a typed `Config<Components>` block registry. Avoids hand-rolling DnD + side panels.

MVP scope (avoid building Webflow):

- Curated block registry, **not** a free-form canvas: `Hero`, `About`, `Services`, `Gallery`, `Testimonials`, `Contact`. New blocks = one component + one Puck field schema.
- Each block exposes a small set of fields (text/textarea/image/select) via Puck's typed `fields:` definition; Puck renders the side-panel editor automatically — no bespoke DnD code.
- "Preview" button opens the public URL in a new tab.
- Same `puckConfig` is reused (a) here in the page builder and (b) at render time on the public page (`<Render data={...} config={puckConfig} />`), and will later power **gallery layout editing**.

Skip in MVP: free-form canvas, custom CSS injection, custom HTML blocks, nested zones beyond the root. These eat 2 weeks.

### Mobile responsiveness priorities

- Owner dashboard fully responsive — owners check it on phone between events.
- Public landing page **mobile-first** — leads find it on Instagram and convert on mobile.
- Calendar reduces to agenda view on phones.
- Page builder is **desktop-only** (show a "best on desktop" notice on mobile). Don't try to ship a mobile DnD editor in month 1.

**Authoring rule** (mirrors `CLAUDE.md` Conventions): default Tailwind classes target mobile; opt into desktop with `sm:`/`md:`/`lg:`. Touch targets ≥44px. No hover-only affordances — always pair `hover:` with `focus-visible:` so keyboard + touch users get the same feedback. Modals fit one viewport without scrolling: use multi-step wizards for long forms, tabs for long stacks. Test every new view at 375px width before marking it done.

### UI style + libraries

| Concern | Pick |
|---|---|
| Component library | **shadcn/ui** — copy/paste, Tailwind, fully owned, modern aesthetic |
| Styling | **Tailwind CSS** |
| Icons | **lucide-react** |
| Calendar | **FullCalendar** (React wrapper) for week/month/agenda + drag-resize; alternative: `react-big-calendar` (lighter, MIT) |
| Page builder | **Puck (`@measured/puck`)** — typed block registry, ships its own DnD + side-panel editor |
| Generic DnD (kanban, gallery reorder) | **dnd-kit** — modern, accessible, smaller bundle than react-dnd |
| Forms | **react-hook-form + zod** |
| Tables | **TanStack Table v8** |
| Charts (dashboard) | **Recharts** — simple, sufficient |
| Toasts | **sonner** |
| Date | **date-fns** (not Moment, not Day.js — date-fns is tree-shakeable) |
| Rich text (notes) | **TipTap** (only if you need it; otherwise plain textarea + markdown) |

Style: clean SaaS look — neutral grays, single accent color (workspace-configurable), generous whitespace, rounded-md corners, no skeuomorphism. Reference: Linear, Cal.com.

---

## 6. Public Website Builder ("Portfolio maker")

This is Gallurio's main conversion surface — every workspace gets a public portfolio at `/w/[orgSlug]` that converts visitors into booking inquiries. It is the highest-leverage feature in the product because it's where leads first meet the business.

> **Detailed implementation plan**: see [`docs/portfolio-maker/`](docs/portfolio-maker/) — `master-plan.md` plus per-phase plans under `phases/`. The notes below are the high-level decisions; the plan files have the file-by-file execution detail.

### Locked structure

A portfolio has exactly **three pages**:

1. **Home** — Puck-composed landing page. Configurable.
2. **Gallery** — Puck-composed gallery page. Configurable.
3. **Contact** — a prebuilt modal that opens from any CTA. **Not configurable** — the form schema is fixed.

This narrow surface is deliberate. We are not building Webflow. The job is to convert visitors quickly, not to give them a CMS.

### Data shape (embedded, not structured)

All composition lives in `Workspace.publicPage`:

- `data: { home: PuckData | null; gallery: PuckData | null }` — Puck round-trips this JSON for both zones.
- `brandKit` — theme preset, font pair, primary/secondary/accent/background/foreground colors, radius, button style. Translated into CSS variables on the public-page wrapper only.
- `templateId`, `publishedAt`, `lastPublishedAt`, `latestVersion`, `seoTitle`, `seoDescription`, `inquiryRecipientEmail`.

Do **not** add separate `Portfolio`, `PortfolioPage`, `PortfolioVersion`, `BrandKit`, `Service`, `Package`, `Testimonial`, `FormTemplate`, or `MediaAsset` collections. Gallery images already live in structured `GalleryItem`/`GalleryCollection` records — Puck gallery blocks reference them by ID. Everything else is happy as embedded JSON.

### Block catalogue (MVP)

10 blocks: `Hero`, `About`, `GalleryGrid`, `GalleryMasonry`, `GalleryCarousel`, `FeaturedWork`, `ServicesList`, `CTABanner`, `ContactCard`, plus `Testimonials` (deferred — added once embedded list of testimonials is needed). Gallery blocks reference `GalleryCollection`/`GalleryItem` by ID; the renderer re-validates `workspaceId` server-side and never trusts Puck props for tenant identity.

### Brand kit (scoped to public pages)

The app shell stays Merriweather + sharp corners + semantic tokens (see `CLAUDE.md` "Design style"). Public portfolios choose from a curated brand kit applied **only** inside the `/w/[orgSlug]` wrapper:

- `themePreset` — one of `minimal | editorial | luxury | bold | romantic | modern`.
- `fontPair` — curated pairings (Merriweather Only, Playfair + Inter, DM Serif + DM Sans, Cormorant + Montserrat, Fraunces + Inter).
- Colors — primary, secondary, accent, background, foreground (hex).
- `radius` — `sharp | subtle | rounded`.
- `buttonStyle` — `solid | outline | soft`.

The renderer translates the brand kit into CSS variables on the page wrapper. App chrome is untouched.

### First-visit wizard

When an owner visits `/page-builder` and `data.home === null`, redirect them to `/page-builder/wizard` — a 5-step guided flow:

1. Pick template (5 starters: wedding photographer, event photographer, planner, venue-stylist, minimal).
2. Confirm branding (pre-filled from `workspace.branding`).
3. Choose theme preset + font pairing + accent color.
4. Upload starter images (at least 1, recommended 5) into a "Featured work" `GalleryCollection`.
5. Review + launch into the editor.

Target time: 5–10 minutes to a respectable first version. Skippable; "Skip wizard" seeds the `minimal` template.

### Editor

- Owner-only.
- Single Puck `<Puck>` instance with a **zone switcher** (Home / Gallery) and a **Desktop / Tablet / Mobile preview toggle** (canvas width clamp — 1440px / 768px / 390px — not iframe).
- Debounced autosave per zone; explicit Publish button flips `publishedAt`.
- Editor styles are scoped so the portfolio brand kit doesn't repaint the editor chrome.
- Mobile screens (`< 1024px`) show a "best on tablet or larger" notice with a preview link; we don't block, we communicate.

### Inquiry form (fixed schema, not configurable)

Two tabs:

1. **Client info** — name, email, phone, preferred contact method.
2. **Booking request** — calendar date picker, time, duration, event type (wedding/engagement/corporate/birthday/anniversary/graduation/other), guest count, location, description.

Honeypot + per-IP rate limit (5 submissions per 10 minutes). UTM/referrer captured silently from the URL and `document.referrer`. Validated by `lib/validators/inquiry.ts` on both client and server.

### Booking Inquiry Lifecycle (simple, two-step)

Every inquiry follows a simple two-step path. Full spec: [`docs/booking-inquiry-lifecycle.md`](docs/booking-inquiry-lifecycle.md).

**Stage 1 — Inquiry to New-Lead Booking** (public form → auto-create, one Mongo transaction)

1. Match-or-create `Client` by `{ workspaceId, email }`.
2. Create `Inquiry` (status `new`, UTM/referrer captured, linked to the client).
3. Create `Booking` with `status: "inquiry"`, `createdFromInquiryId`, event details pre-filled.
4. Set `inquiry.convertedClientId` to the matched client.

Default booking lists hide only `cancelled`; the inquiry-status booking surfaces as a new-lead event and in the Lead Inbox. The owner receives one notification email — the only automated email in the flow.

**Stage 2 — Owner Approves** (Lead Inbox → confirmed booking)

Owner opens `/inquiries`, reviews the lead, and clicks **"Approve booking"**. The existing Create-Booking modal opens pre-filled with the inquiry's client + event details. The owner adds the pricing, deposit, and terms they agreed with the client **off-platform**, then saves. The booking is promoted (not duplicated): `Booking.status` → `booked`, `Inquiry.status` → `converted`, `Inquiry.convertedBookingId` set.

Gallurio does **not** broker the owner↔client conversation. There is no in-app quoting, counter-offer loop, client portal, or durable workflow — those were removed. Owners and clients negotiate through their own channels; Gallurio records the final booking.

### SEO

- Per-workspace `<title>`, `<meta description>`, OG image (workspace logo for now; auto-generated hero via `next/og` is a later enhancement).
- `sitemap.xml` lists `/w/<slug>` and `/w/<slug>/gallery` for workspaces where `publicPage.publishedAt !== null`. Unpublished excluded.
- `robots.txt` allowing public pages, blocking `/api`, `/dashboard`, `/page-builder`, `/inquiries`, `/settings`, `/onboarding`, `/sign-in`, `/sign-up`.
- Server-rendered so Google sees content.
- `schema.org/LocalBusiness` JSON-LD on Home; `ImageGallery` on Gallery.
- Image alt text required at upload time.

### Custom domain support (v1.1, NOT MVP)

Use Vercel's [Domains API](https://vercel.com/docs/projects/domains) — call it from an admin endpoint when an owner adds a domain, then verify via TXT record. Wildcard SSL is automatic.

### Basic analytics

A minimal `AnalyticsEvent` model captures view / cta_click / form_open / form_submit per workspace + path + opaque session ID + device class + UTM/referrer. No PII, no IPs. Dashboard tile shows last-7-day views, inquiries, and conversion rate. Third-party analytics (Plausible/PostHog/GA) is out of scope for MVP.

---

## 7. Recommended High-Value Features

Ordered by ROI per dev-hour:

| Feature | Why it matters | Effort |
|---|---|---|
| **HitPay deposit collection link** | Owner sends a 1-click link (GCash/Maya/card via HitPay one-off payment-requests), takes 30% deposit, halves no-shows. Massive perceived value in PH. Note: one-off payments support GCash; only recurring/subscription does not. | 1 day |
| **Automated email reminders** (T-7 / T-1) | Cuts no-shows + saves the owner manual work. Use Vercel Cron + Resend. | 1 day |
| **Inquiry → Booking 1-click conversion** | The wedge: "we turn DM inquiries into paying bookings." | 0.5 day |
| **Simple invoice PDF** | Owners currently use Word docs. Generate via `@react-pdf/renderer`. | 1 day |
| **Public gallery shareable link** | Owners share "view your event photos" with clients → drives WOM. | 0.5 day |
| **WhatsApp message templates** (copy-to-clipboard) | Don't integrate the API — just pre-fill `wa.me/<phone>?text=...` links. 1-hour win, looks like an integration. | 2 hours |
| **QR check-in** | Niche but viral feature for venues/coordinators. Generate QR per booking, scan page marks status=completed. | 1 day |
| **Lead pipeline (Kanban)** | Same data, different view. Hugely visual demo asset. | 1 day |
| **Contract templates with merge fields** | Owners pay for this alone. v1.1. | 3 days |

**Cut**: SMS (Twilio cost + compliance), AI features, two-way calendar sync, payment processors beyond HitPay.

---

## 8. Development Roadmap (1 Month)

Assume 5–6 productive hours/day, 6 days/week = ~30 hours/week. Sequence is dependency-ordered.

### Week 1 — Foundation

**Goal**: a logged-in user can create a workspace and a booking.

- Day 1: repo init, Next.js + Tailwind + shadcn, Vercel deploy, Atlas cluster, Mongoose connection. CI = Vercel previews. ✅ ship a "Hello workspace" page.
- Day 2: Clerk integration, sign-in flow, middleware tenant resolution.
- Day 3: Workspace creation flow + slug routing + dashboard shell.
- Day 4: Clients CRUD (list, create, edit, delete).
- Day 5: Bookings CRUD with status field, list view.
- Day 6: Calendar view with FullCalendar wired to bookings.

**Cut if behind**: calendar drag-resize (keep view-only).

### Week 2 — Monetization + Pipeline

**Goal**: a workspace can take an inquiry from the public web and convert to a paid booking.

- Day 7: Public inquiry form route, Turnstile, Resend notification to owner.
- Day 8: Inquiry → Client → Booking conversion flow.
- Day 9: HitPay recurring billing (`POST /v1/recurring-billing`, card-only) for subscription checkout, webhook to set `plan` on workspace.
- Day 10: HitPay one-off payment-request for deposit collection per booking + transactions log.
- Day 11: Image upload to R2 (presigned URLs), gallery items, reorder.
- Day 12: Public landing page route, hardcoded template rendering workspace data.

**Cut if behind**: deposit collection. Subscription billing is non-negotiable; deposit links can be v1.1.

### Week 3 — Polish + Page Builder

**Goal**: a workspace can publish a customized public page and look professional.

- Day 13: Editable hero/about/services/contact blocks (side panel forms).
- Day 14: Gallery block + theme picker (color + font).
- Day 15: Section reorder with dnd-kit.
- Day 16: Public page SEO (metadata, OG image, sitemap).
- Day 17: Email reminders (Vercel Cron: T-7 & T-1 day notifications).
- Day 18: Dashboard widgets (today, upcoming, revenue, pipeline counts).

**Cut if behind**: section reorder (keep fixed order). Theme picker.

### Week 4 — Launch Prep

**Goal**: ready to take the first 10 customers.

- Day 19: Marketing site (landing, pricing, FAQ) — same Next.js app, `(marketing)` route group.
- Day 20: Onboarding checklist + sample data toggle + activation emails.
- Day 21: Super-admin page (list orgs, MRR, impersonate).
- Day 22: Error tracking (Sentry), basic analytics (PostHog), backups verification (Atlas auto-backup on by default).
- Day 23: Manual QA across 3 browsers + mobile. Fix top 5 bugs.
- Day 24: Soft launch — invite 10 known users, monitor, fix in real time.

**Always-cut list** (in this order if you slip):
1. Email reminders → manual reminder buttons instead.
2. Page builder reorder → fixed order.
3. Theme picker → single theme.
4. Kanban view → list view only.
5. Public page → "coming soon" placeholder per workspace.

Never cut: auth, billing, bookings CRUD, inquiry form.

---

## 9. Monetization & Pricing

### Tiers (PH launch — PHP)

| Tier | ₱/mo | Includes | Cap |
|---|---|---|---|
| **Free** | ₱0 | 1 workspace, up to 10 bookings, 1 GB storage, public landing page | After 10 bookings: read-only until upgrade |
| **Starter** | **₱499/mo** | Unlimited bookings, 5 GB storage, branded inquiry form, accept GCash/Maya/cards from clients | — |
| **Pro** | **₱1,199/mo** | + custom domain, 50 GB storage, invoice PDFs, remove Gallurio branding | — |

> **Subscription payment methods**: card-only (Visa/Mastercard). HitPay does not currently offer GCash for recurring billing. Tenants can still accept GCash from their own end-clients via their HitPay account — that flow just isn't bundled into Gallurio for MVP.

### Billing model decisions

- **Flat per workspace, not per user.** Per-user pricing punishes growing customers. You'll win more conversions with flat pricing in a SMB market.
- **Annual = 2 months free** (i.e., 16.6% off). Critical for cash flow.
- **Free tier in MVP.** Bucks the conventional "trial > free" advice — the PH SMB market is heavily prepay-averse and a usable free tier is a real wedge against spreadsheets. Capped at 10 bookings so it converts naturally as the studio grows.
- **HitPay Recurring Billing**, not a custom system. HitPay's hosted authorization handles card tokenization + 3DS in one flow. Pricing is inline (per `POST /v1/recurring-billing`) — no plan IDs to maintain.
- **No trial period** at launch. Free tier covers the "try before you pay" job; trial UX adds complexity we don't need until churn data demands it.

### Storage limits & bandwidth

- Cloudflare R2: $0.015/GB-month storage, **free egress**. At 5GB/customer × 1,000 customers = $75/mo storage. Bandwidth essentially free — this is why R2 vs S3.
- Hard-cap upload at the limit, soft-warn at 80%. Show usage in settings.

### Realistic monthly infrastructure costs (first 100 customers)

| Item | Cost |
|---|---|
| Vercel Pro | $20/mo |
| MongoDB Atlas M10 | ~$60/mo |
| Cloudflare R2 (500 GB) | $7.50/mo |
| Clerk (under 10k MAU) | $0 |
| Resend (50k emails) | $20/mo |
| Sentry (Developer) | $0–26/mo |
| PostHog (1M events free) | $0 |
| Domain (yourdomain.com) | ~$1/mo |
| HitPay fees (PH, card recurring) | ~3.5% + per-charge flat fee (check HitPay dashboard for current PH card rate) |
| **Total fixed** | **~$110–135/mo** |

100 customers × ₱499 ≈ **₱49,900 MRR (~$890)**. Gross margin still ~85% after HitPay fees. Pricing tighter than US-market SaaS, but PH SMB ARPU is realistic at this level — focus on volume.

### Recommended providers (final list)

| Need | Provider |
|---|---|
| Hosting (Next.js) | **Vercel** |
| Database | **MongoDB Atlas** |
| File storage | **Cloudinary** (signed browser uploads + on-the-fly transforms) |
| Auth | **Clerk** |
| Transactional email | **Resend** (or Postmark if you need >1M/mo) |
| Marketing email | **Resend Broadcasts** or Loops.so |
| Analytics | **PostHog** (product) + **Plausible** (marketing site) |
| Error monitoring | **Sentry** |
| Uptime monitoring | **Better Stack** (free tier) |
| Payments | **HitPay** (subscription billing; PHP, card-only for recurring) |
| CDN/DNS/WAF | **Cloudflare** |
| Status page (later) | **Instatus** |

---

## 10. Marketing Strategy

### Ideal target customer (be specific)

**Pick one niche to launch:** "Wedding photographers in [your country], 1–5 person studios, currently using a spreadsheet + Instagram DMs + Calendly."

Why this niche:
- Visual industry → galleries matter → strong differentiator.
- Active on Instagram/TikTok → easy to reach.
- $$$ events → can afford $19–49/mo.
- Pain is acute: lost inquiries, missed dates, manual invoice work.
- Word-of-mouth in tight community.

After 50 customers, broaden to: wedding planners → venues → coordinators → stylists. Same product, micro-positioning per niche.

### Niche positioning

> "The CRM built for wedding photographers — turn Instagram DMs into booked weddings in under 3 minutes."

NOT: "All-in-one event management platform for businesses of all sizes." That's the death of an MVP.

### Launch strategy (week-by-week)

**Pre-launch (during build):**
- Tweet/post the build journey daily. Show screenshots. Get 200 followers in the niche.
- Reach out to 20 photographers personally — "I'm building this, can I show you a demo and get your feedback? Free for 6 months if you give me 30 minutes."
- Build an email waitlist (one-page site: "EventCRM for wedding photographers — coming May 2026").

**Launch week:**
- Email waitlist + 1:1 invitations to the 20 demo'd users.
- Post a 60-second demo on TikTok, IG Reels, Twitter, LinkedIn (same video, 4 platforms).
- Product Hunt launch — schedule for Tuesday/Wednesday, prep assets the week before.
- Post in r/WeddingPhotography, /r/SaaS (Show HN), niche Facebook groups (don't spam — share a story).

**Post-launch:**
- Weekly customer-spotlight content ("How [photographer] books 3x more weddings").
- Free tools page: "Free wedding invoice template", "Free client questionnaire" — SEO bait + email capture.

### Outreach strategy

- DM 10 photographers/day on Instagram. Template:
  > "Hey [name], I love your work, especially [specific shoot]. I just built a CRM specifically for wedding photographers — would you be willing to do a 15-min demo? I'm giving 6 months free to my first 20 photographers who give feedback."
- Reply rate ~10–15%. Demo-to-paid ~30–50% in friendly niches.

### Content marketing (low-effort, high-leverage)

- **SEO targets** (specific, low-competition):
  - "wedding photographer CRM"
  - "best client management for photographers"
  - "how to manage wedding inquiries from Instagram"
  - "wedding contract template" (free tool → email capture)
- One blog post/week, 1,500 words, written from real customer questions.
- Programmatic SEO play (later): one page per city × niche (e.g., "Wedding photographer CRM in Berlin").

### Social ideas

- **TikTok/Reels**: 30-second screen recordings — "Watch me book a wedding in 60 seconds." Music + zoom-ins. Cheap, sharable.
- **Twitter**: build-in-public — MRR updates, hard problems solved, customer wins.
- **LinkedIn**: longer-form "lessons from building a SaaS" posts.
- **Instagram**: carousel "5 mistakes wedding photographers make with client follow-up" → CTA in bio.

### Partnerships

- Existing photographer Facebook groups: offer the admin a free Pro account in exchange for sharing.
- Photography educators (those who sell courses) — affiliate 20% recurring commission.
- Adjacent SaaS (Honeybook is the giant — go after their disgruntled users on Reddit/Twitter). Don't fight Honeybook head-on; position as cheaper + faster + niche-specific.

### Referral system

In settings → Earn 1 month free for every paying customer you refer (Stripe Coupons applied automatically). Add after first 20 customers; don't over-engineer.

### How to get first 10 customers (the only way)

1. **Manual.** Not ads, not SEO, not Product Hunt. Direct conversations.
2. List 50 photographers you can find on Instagram in your region.
3. DM each one a personal note + offer free Pro for 6 months in exchange for 30 minutes of feedback.
4. After demo, ask: "Would you actually use this? What's missing to make it a 'yes'?"
5. Build the top-3 missing features in week 2.
6. Re-engage all 50, convert 10–20% to paid.

### How to validate demand fast

- Stop building the moment you've talked to 10 photographers and the answer is "meh." Pivot.
- Hard signal: "When can I start using it? I'll pay now." (Got this from ≥3 people = ship it.)
- Soft signal: "Looks cool!" (Means no.)

### How to avoid building unnecessary features

- Every feature must have a name attached: "Sarah said she'd pay for X." If you can't name a person, don't build it.
- Public roadmap (Trello or Linear public view) — let customers upvote.
- Build for the *median* customer, not the loudest.

---

## 11. Security & Scalability

### Multi-tenant security (the #1 risk)

- **Single source of truth for `orgId`**: it comes from the session, never from request body or URL params. URL `orgSlug` is verified against the session's active org on every request.
- **Mongoose middleware**: hooks `pre('find')`, `pre('findOne')`, `pre('updateOne')`, etc. to inject `{ orgId: ctx.orgId }` into the filter. If `ctx.orgId` is unset, the query throws. This prevents accidental cross-tenant data leaks.
- **Test it**: write a "tenant isolation" test that creates two orgs and asserts org A cannot read org B's data. Run on every CI.
- **Never expose Mongo `_id` in URLs in a way that lets users enumerate**; always re-verify ownership server-side.

### File upload security

- Presigned PUTs with short TTL (5 min).
- Server-side content-type allowlist (`image/jpeg`, `image/png`, `image/webp`, `image/avif`).
- Max file size 25 MB enforced both at the presign step and at R2 via condition.
- Generate thumbnails server-side or use Cloudflare Image Resizing — never trust client-supplied dimensions.
- Strip EXIF GPS metadata before storing (sharp's `withMetadata: false`).
- Object keys are random UUIDs, not user-supplied names → prevents path traversal and predictable enumeration.

### Auth best practices

- Clerk handles password hashing, MFA, session rotation. Don't reinvent.
- Session cookies: HttpOnly, Secure, SameSite=Lax (Clerk default).
- CSRF: not an issue with Clerk + same-origin API routes, but use double-submit tokens for any cookie-based mutation outside Clerk's flow.
- API keys (v1.1): per-org, hashed at rest, rotateable, scoped.

### Backups

- Atlas continuous backup on M10+ (point-in-time restore for 7 days, included).
- Weekly mongodump exported to R2 via Vercel Cron + GitHub Actions — defense in depth.
- R2 has built-in object versioning — enable it.

### Rate limiting

- Upstash Redis + a simple sliding-window limiter in middleware.
- Public inquiry form: 5/min per IP.
- Auth endpoints: handled by Clerk.
- Authenticated APIs: 60/min per user.

### Scaling considerations (in order you'll hit them)

| Scale milestone | Bottleneck | Fix |
|---|---|---|
| ~100 orgs | None | Stay on M10 |
| ~1,000 orgs | Mongo connections | Use Mongoose pooling, Vercel functions cap connections — consider data-API or Atlas serverless |
| ~5,000 orgs | Index size, slow queries | Audit slow queries, add compound indexes, archive `activityLogs` |
| ~10,000 orgs | Single-region latency | Add a second Atlas region for read replicas; CDN public pages aggressively |
| 50k+ orgs | Vercel function cold starts | Move hot paths to edge runtime; consider extracting public-page rendering to a Cloudflare Worker |

**Don't pre-scale.** Each fix here is a 1–2 day project you do *when you have the revenue and the problem*, not on day 1.

### Testing strategy

We test aggressively because a solo founder can't afford to babysit every regression in a browser. **A change without a test is a change that ships broken.**

**Stack (locked):**

- **Unit + component**: Vitest + `@testing-library/react` + `happy-dom`. Vitest is React-19/Next-16 native, fast, and shares its config with the rest of the toolchain.
- **DB-touching tests**: `mongodb-memory-server` — never mock Mongoose. Mocked DB tests pass while the real query is wrong; an in-memory Mongo keeps query semantics honest at trivial speed cost.
- **E2E (later, not MVP)**: Playwright. Reserved for tenant-isolation and onboarding-happy-path coverage in v1.1+. Don't build E2E for MVP — unit + component is enough.
- **CI**: GitHub Actions runs `pnpm typecheck && pnpm lint && pnpm test` on every push. Failing tests block merge.

**What must have a test:**

| Surface | Test type | Why it's mandatory |
|---|---|---|
| Mongo aggregations / `_data/*` modules | Unit + in-memory DB | Math errors in money KPIs are how trust evaporates. |
| Server actions (`lib/actions/*`) | Unit + in-memory DB | Auth + validation + DB write in one function — easy to regress. |
| Zod validators | Unit | Cheap to test; cheap to break. |
| Tenant-scoped queries | Unit (the "isolation" test) | Two orgs, assert org A cannot read org B. This is the #1 security risk per §11. |
| Webhook handlers (HitPay, Clerk) | Unit | Signature verification + happy path + one rejection. Webhooks fail silently in prod — tests are the only signal. |
| FX conversion + currency formatting | Unit | Off-by-one decimals are visible to customers. |
| React components | "Renders without crashing" smoke + one interaction if interactive | Catches prop-shape drift the moment models change. |
| Puck block authoring | Snapshot of `Render` output | Prevents block-registry drift between editor + public renderer. |

**Conventions:**

- Tests **colocate** with source: `dashboard-metrics.ts` ↔ `dashboard-metrics.test.ts` in the same folder. Easier to find, easier to keep in sync, deletes follow the source.
- **Mock at the network boundary**, not internal modules. HitPay, Cloudinary, and openexchangerates get faked at their HTTP layer (MSW or `vi.fn()` on `fetch`). Internal modules stay real.
- **Each test bootstraps and tears down its own DB state.** A `beforeEach` resets collections; no test depends on another test's leftovers.
- **`pnpm test` runs before any task is marked complete.** Equally: `pnpm test` runs locally before `git push`. Pre-commit hook enforces it once we have one.

**What NOT to test (yet):**

- CSS / visual regressions — wait for Chromatic in v1.1 when there's a paying customer to justify it.
- Clerk's internals — trust the vendor.
- `formatRelative` / locale strings — `Intl` is well-tested upstream.

This isn't comprehensive coverage for its own sake. It's a forcing function: **if writing the test feels expensive, the code being tested is probably structured badly.** Refactor for testability rather than skipping the test.

---

## 12. Final Tech Stack — Recommended Decisions

| Concern | Pick | Why |
|---|---|---|
| **Framework** | Next.js 14+ App Router | RSC reduces client bundle; single deploy; great DX |
| **Auth** | Clerk | Multi-tenant Organizations built-in; saves 1–2 weeks |
| **Database** | MongoDB Atlas | Document model fits this product; managed = no ops |
| **ODM** | Mongoose | Mature, plugin ecosystem, easy to enforce tenant isolation |
| **Validation** | Zod | Share schemas client + server; trivial to integrate with RHF |
| **State (client)** | TanStack Query for server state, Zustand if needed for UI state | Don't reach for Redux. Most state is server state. |
| **Forms** | react-hook-form + zod | The combo; fast, ergonomic, well-typed |
| **API** | Next.js Route Handlers + Server Actions | No separate API layer; Server Actions remove a round-trip for forms |
| **Caching** | Next.js `revalidateTag` + ISR for public pages | Built-in, no Redis needed in MVP. Add Upstash for rate limiting only. |
| **Images** | Cloudflare R2 + Next/Image custom loader | Zero egress = doesn't break the unit economics at scale |
| **Deployment** | Vercel | Best Next.js DX; preview URLs per PR; zero-config edge |
| **CI/CD** | Vercel Git integration + GitHub Actions for tests | Vercel = deploys; GHA = test + lint + typecheck gate |
| **Testing** | Vitest (unit) + Playwright (e2e, 3 critical flows only) | Sufficient for MVP; don't aim for 100% coverage |
| **Observability** | Sentry + PostHog + Better Stack | Errors + product analytics + uptime — the trio |
| **Background jobs** | Vercel Cron + Inngest if it gets complex | Don't deploy a worker for 2 cron jobs |
| **Email** | Resend | Developer-friendly, React Email templates, fairly priced |
| **Payments** | HitPay (Recurring Billing, card-only for subscriptions) | Stripe doesn't onboard PH businesses; Xendit's PH KYC for the marketplace was too much friction for MVP. HitPay ships subscription billing with simpler onboarding across SG/MY/PH/ID/TH. Marketplace dropped from MVP. |
| **Linting** | Biome (or ESLint + Prettier) | Biome is faster; either is fine |
| **Type safety** | TypeScript strict mode | Non-negotiable. Saves you weeks of bugs. |

---

## 13. Risks & Mistakes to Avoid

### Common SaaS MVP mistakes

- **Building before talking.** Most failed SaaS spent month 1 coding, not talking. Reverse it: 10 customer convos before writing the first line of code.
- **Solving for "all event businesses."** You have no message, no SEO, no community. Pick one vertical.
- **Free tier too early.** Free users are not customers. They're feedback. Charge from day 1.
- **No deadline.** Without a public launch date, MVPs become endless polish. Pre-announce the launch.
- **Ignoring billing until last.** HitPay subscription setup + webhook reconciliation + dunning take longer than you think. Build billing in week 2, not week 4.

### Technical overengineering risks

- Splitting into microservices. **Don't.** One Next.js app until you have 50k MRR.
- Building your own auth. **Don't.** Use Clerk or Auth.js.
- Custom-built billing or invoicing engine. **Don't.** Stripe Billing.
- Multi-region from day 1. **Don't.** Single-region until latency complaints.
- GraphQL "for flexibility." **Don't.** Route handlers + zod are faster to ship.
- Designing for "what if 1M users." You won't have 1M users. Design for the next 10x.

### Pricing mistakes

- Pricing too low ("I'll be cheaper than Honeybook!"). Then you can't afford to support customers. Cheap pricing attracts price-sensitive customers who churn fastest.
- Per-user pricing in a small-team market.
- No annual option (kills cash flow).
- Hiding pricing on the marketing site (SMB buyers will bounce).
- Adding too many tiers. 2 tiers in MVP, 3 max long-term.

### Onboarding problems

- Empty state — new users see a blank dashboard and bounce. Solution: sample data toggle.
- Too many setup steps before first value. Goal: time-to-first-booking < 3 minutes.
- No activation email sequence. Day 0: welcome. Day 1: "Added a client yet?" Day 3: "Need help?" Day 7: case study.

### Scaling traps

- Caching too aggressively before you understand traffic patterns.
- Premature DB sharding.
- Background-job systems for tasks that could be inline.
- "Refactor sprints" before product-market fit.

### What to avoid if you want to launch fast and get paying customers

1. **Don't be invisible.** Build in public. Daily updates.
2. **Don't perfect.** Ship at 70%, fix in production.
3. **Don't skip billing.** Charge from day 1; trial is fine, free is not.
4. **Don't pick a broad market.** Narrow niche → wider waves later.
5. **Don't avoid sales.** The first 10 customers are sold, not converted.

---

## Appendix A — Recommended File Structure for First Commit

```
.
├── app/
├── lib/
├── components/
├── public/
├── .env.example
├── .gitignore
├── biome.json
├── middleware.ts
├── next.config.mjs
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

`.env.example`:
```
DATABASE_URL=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_WEBHOOK_SECRET=
HITPAY_API_KEY=
HITPAY_WEBHOOK_SALT=
HITPAY_API_BASE=https://api.sandbox.hit-pay.com
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
RESEND_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
```

Note: prices are defined in code at `lib/hitpay/plans.ts` — HitPay's recurring-billing endpoint accepts inline pricing per call, so unlike Stripe there are no dashboard-configured `price_…` IDs to wire through env vars.

## Appendix B — First-Week Daily Standup Template (for the solo founder)

Each morning, write 3 lines in a notes file:

1. **Yesterday I shipped:** …
2. **Today I'm shipping:** … (one feature, max)
3. **What's blocking me:** …

If you can't write line 1 for two days in a row → you're stuck on something. Cut scope or ask for help.

---

**End of blueprint.** Next step: open `/sign-up`, deploy "Hello workspace" to Vercel today, DM 10 photographers tomorrow.
