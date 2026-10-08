# Workspace vocabulary presets + animated marketing page

## Context
Gallurio serves 8 business types (`BUSINESS_TYPE_VALUES` in `lib/validators/workspace.ts:18`: photographer, venue, planner, stylist, catering, entertainer, artists, other), but the app's words are photographer-generic: "Bookings", "Clients", "Teams". A venue owner thinks in *Events* and *Venues*, not *Bookings* and *Teams*. Goal: an owner picks a ready-made **vocabulary preset**. It rewrites the entity words everywhere in the app UI and in member-facing emails. Routes, data, and logic stay the same. Second goal: make the marketing page come alive on scroll, and add a section that shows off the vocabulary feature.

Decisions locked (user answers):
- **Preset only.** No free text and no per-item mixing.
- **Workspace-wide.** The owner sets it and every member sees it.
- **Reach:** in-app UI plus emails to workspace members. Not end-client emails, the public portfolio, or marketing.
- **Motion:** Playful.
- The preset is **decoupled** from business type. The default is "Match business type" (stored as `null`), so it follows `businessType`. "other" maps to Standard. The owner can pin any preset.

## Deliverable order
1. **Mockups first (stop for review)**, made with the `impeccable` skill as standalone files (memory: mockups are standalone HTML, never a Next route):
   - `docs/mockups/customize-vocabulary.html`: Settings → Customize with a new Vocabulary section above Theme. It has one preset card per business type plus "Match business type" (active by default, with a badge showing the resolved preset). A live mini-sidebar preview relabels as presets are hovered or selected. The owner state is editable. The member state is read-only ("Set by your workspace owner"). Below the cards is a "words that change" strip: Inquiries/Bookings/Clients/Teams → new words, plus universal items (Dashboard, Portfolio, Notifications, Settings) marked unchanged. Shown at 375/768/1280, light + dark, following DESIGN.md (single teal accent, flat, hairline rings).
   - `docs/mockups/marketing-animated.html`: the current marketing sections (hero → split cards → marquee → 4 feature panels → migration → transparency → manifesto → pricing → compare → CTA) with Playful motion added. Sections rise and fade in. Cards stagger. Feature panels slide in from their image side (mirrored for RTL). Migration steps draw in sequence. Trust items tick in. Plus a **new section, "Speaks your trade"**: business-type chips; picking one animates an app-sidebar mock, and labels flip and slide to the new words. It autoplays through types when idle. `prefers-reduced-motion` turns all motion into instant state.
2. After mockups are approved, write the spec doc `docs/vocabulary/vocabulary-presets.md` (Problem → Root cause → Target → Files → Acceptance), then implement.

## Vocabulary options (pick per type during mockup review; ★ = recommended default)
Universal, never renamed: Dashboard, Portfolio, Notifications, Settings.

| Preset | Inquiries | Bookings | Clients | Teams |
|---|---|---|---|---|
| Standard (other) | ★Inquiries | ★Bookings | ★Clients | ★Teams |
| Photographer | ★Inquiries | ★Sessions · Shoots | ★Clients · Couples | ★Crews · Teams |
| Venue | ★Inquiries · Requests | ★Events · Reservations | ★Hosts · Clients | ★Venues · Spaces · Halls |
| Planner | ★Leads · Inquiries | ★Events · Projects | ★Clients · Couples | ★Teams · Crews |
| Stylist | ★Requests · Inquiries | ★Appointments · Bookings | ★Clients | ★Teams · Studios |
| Catering | ★Quote requests · Inquiries | ★Orders · Events | ★Customers · Clients | ★Kitchens · Crews · Branches |
| Entertainer | ★Inquiries | ★Gigs · Shows | ★Clients | ★Acts · Bands · Lineups |
| Artists | ★Inquiries · Commissions | ★Commissions · Projects | ★Patrons · Clients | ★Studios · Collectives |

(For Artists, if Bookings becomes Commissions, then Inquiries stays Inquiries.)

## Change map (implementation, after mockup sign-off)
**Mechanism: catalog token substitution, done once at load.** Messages use ASCII tokens such as `%team%`, `%teams%`, `%Team%`, `%Teams%`, `%aTeam%` (for a/an). The 4 concepts are inquiry, booking, client, and team. A pure function rewrites the catalog before next-intl sees it, so call sites never change. ICU braces stay untouched. Each locale defines the forms it needs: `ar` gets definite forms, and `fil`/`th`/`id` mostly use invariant plurals. A test enforces coverage.

| Area | File(s) | Change |
|---|---|---|
| Preset table | `lib/vocabulary/presets.ts` (new) | Preset ids = `standard` + business types, with term forms per locale |
| Apply | `lib/vocabulary/apply.ts` (new) | `applyVocabulary(messages, locale, preset)` rewrites only the `app.*` subtree and the member-email namespace. Memoized per (locale, preset): 5×8 small objects |
| Resolve | `lib/vocabulary/resolve.ts` (new) | `workspace.vocabularyPreset ?? fromBusinessType(businessType)`, where other → standard |
| Model/validator | `lib/db/models/Workspace.ts:86`, `lib/validators/workspace.ts` | Add `vocabularyPreset: enum \| null`, default `null` |
| Request config | `lib/i18n/request.ts` | Resolve the active workspace through the existing cached (`React.cache`) session/workspace helpers. Skip quietly when there is no session. Apply the vocabulary. The client provider then gets rewritten messages for free (confirm the `(app)` layout passes `getMessages()`) |
| Action | `app/[locale]/(app)/settings/_actions.ts` | `updateVocabularyPresetAction` uses `ownerContext()`/`requireRole('owner')`, Zod, and a filter by session `workspaceId`. It runs `revalidatePath` on the app layout so every surface updates right away (data-integrity rule) |
| Settings UI | `app/[locale]/(app)/settings/customize/_panel.tsx` + page | New Vocabulary section: owner editable with optimistic select and rollback toast on error; member read-only |
| Copy | `messages/{en,fil,id,ar,th}.json` | Tokenize the `app.*` strings that mean the entity: roughly 135 team, 215 booking, 110 client, 55 event hits in `en`. Leave product-name or technical uses alone (file names, "Booking migration" marketing). Done namespace by namespace, all 5 locales together |
| Hardcoded literals | grep `.ts/.tsx` for literal Team/Booking/Client in toasts and Zod messages | Move them into catalog keys |
| Member emails | `lib/email/*` (see `emails` skill) | Build the translator with `applyVocabulary(messages, locale, resolve(workspace))`. End-client emails stay unchanged |
| Notifications | `lib/notifications/*` | Copy comes from the `app.notifications` catalog, so it should be covered automatically. Verify any stored, pre-rendered text |
| Marketing | `app/[locale]/(marketing)/page.tsx` + new `_components/vocabulary-showcase.tsx`; `marketing.vocabulary.*` ×5 | Reuse the IntersectionObserver reveal in `lib/page-builder/MotionObserver.client.tsx` (`data-anim` → `pf-in-view`), adding marketing variants in `globals.css` with reduced-motion guards. Use `motion` (already installed) only for the label-flip in the showcase. Register the reveal helper in `REUSABLE_CODE.md` if it gets generalized |

**Out of scope:** route paths (`/teams` stays), icons, the public portfolio, marketing copy for other features, and end-client emails.

## Tests
- `apply.test`: forms, capitalization, a/an, ICU stays intact, only the `app` subtree is touched.
- Coverage test: every `%token%` used in each locale catalog is defined for every preset, and no `%…%` is left after applying all 8 presets × 5 locales. This joins `messages/encoding-sanity.test.ts`.
- Resolve test: null follows business type; other → standard.
- Action tests: owner-only, member rejected, tenant isolation, invalid preset rejected. Uses in-memory Mongo.
- Panel component test: owner vs member render, optimistic rollback.
- Email test: a member email renders the preset word.

## Verification
- Scoped `pnpm test --run vocabulary` plus the touched areas, then eslint, then `tsc --noEmit` (orchestrator only, one at a time).
- Playwright, one batched run:
  1. Owner sets Venue in Customize. Assert sidebar, Teams page title, bookings table header, and a dialog all say Venues/Events. Sign in as a member and check the same words with the control read-only. Reset to Match.
  2. Marketing page at 375/768/1280 × 5 locales × light/dark. Scroll through and assert sections reach their in-view state, check the `ar` showcase geometry, and confirm reduced motion shows final states.
