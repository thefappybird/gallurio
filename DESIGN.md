---
name: Gallurio
description: Multi-tenant CRM for event businesses — bookings, calendar, clients, gallery, and public portfolios.
colors:
  background: "oklch(0.972 0.004 235)"
  foreground: "oklch(0.26 0.008 255)"
  card: "oklch(0.988 0.003 235)"
  primary: "oklch(0.28 0.008 255)"
  primary-foreground: "oklch(0.985 0.002 235)"
  secondary: "oklch(0.945 0.005 235)"
  secondary-foreground: "oklch(0.30 0.008 255)"
  muted: "oklch(0.945 0.005 235)"
  muted-foreground: "oklch(0.52 0.012 250)"
  border: "oklch(0.90 0.006 235)"
  destructive: "oklch(0.577 0.245 27.325)"
  brand: "oklch(0.55 0.10 195)"
  brand-foreground: "oklch(0.985 0 0)"
  brand-2: "oklch(0.65 0.10 195)"
  brand-3: "oklch(0.78 0.08 195)"
  brand-4: "oklch(0.88 0.05 195)"
  ring: "oklch(0.60 0.10 195)"
  onboarding-warm: "oklch(0.975 0.014 85)"
  event-booked: "oklch(0.55 0.10 195)"
  event-completed: "oklch(0.55 0.13 145)"
  event-cancelled: "oklch(0.60 0.18 25)"
  event-inquiry: "oklch(0.55 0.04 250)"
typography:
  headline:
    fontFamily: "var(--font-jakarta), Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 1.2rem + 1.2vw, 1.875rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "var(--font-jakarta), Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "var(--font-jakarta), Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "var(--font-jakarta), Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.05em"
rounded:
  control: "0.25rem"
  surface: "0rem"
  control-sm: "0.2rem"
spacing:
  sm: "0.75rem"
  md: "1rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.control}"
    padding: "0 0.625rem"
    height: "2rem"
  button-brand:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-foreground}"
    rounded: "{rounded.control}"
    padding: "0 0.625rem"
    height: "2rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "0 0.625rem"
    height: "2rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.surface}"
    padding: "1rem"
---

# Design System: Gallurio

## 1. Overview

**Creative North Star: "The Studio Ledger"**

Gallurio sits where creative work meets exact bookkeeping. An event business's calendar is full of shoots, weddings, and launches — messy, human, deadline-driven — but the tool that runs the business underneath has to be as precise as a ledger: every booking accounted for, every client record trustworthy, nothing left ambiguous. The interface reflects that split. It is quiet and neutral-cool at rest (an almost-white "dirty white" ground, never stark black/white), so the work itself — photos, client names, dates — carries the visual weight. One deliberate accent, a deep teal, marks what's actionable: primary buttons, the active nav item, today's date, a booked event. Everything else stays disciplined and gets out of the way.

This system explicitly rejects the generic SaaS-cream dashboard look (gradient hero-metric tiles, glassmorphism, warm sand/parchment backgrounds, identical icon-card grids), sterile enterprise/legacy-ERP chrome, and visual clutter — competing badges and accents fighting for attention on one screen. Surfaces are flat, edges are sharp by default, and depth comes from tone, not shadow.

**Key Characteristics:**
- Neutral-cool "dirty white" / soft-charcoal base — never pure black or pure white.
- One brand accent (teal, hue 195) used sparingly and consistently for anything actionable.
- Flat surfaces: a hairline ring border does the job shadows would elsewhere.
- Controls are gently rounded; structural frames (cards, dialogs, sidebar) are sharp-cornered by default.
- A theme-invariant event-status vocabulary (booked/completed/cancelled/inquiry) that reads identically in light and dark mode.
- Single type family, Plus Jakarta Sans, carrying the whole hierarchy through weight and size, not font-pairing.

## 2. Colors

A restrained, tinted-neutral palette (faint cool hue ~235–255) with one committed accent, plus a small theme-invariant vocabulary for calendar/event state.

### Primary
- **Ledger Charcoal** (`oklch(0.28 0.008 255)` light / `oklch(0.90 0.004 235)` dark — `--primary`): default text buttons, high-emphasis UI text. Near-black/near-white, never pure.

### Secondary
- **Studio Teal** (`oklch(0.55 0.10 195)` — `--brand`): the single deliberate accent. Primary CTAs, active sidebar/nav item, focus rings, today's date on the calendar, the "booked" event state. Caps at roughly 10–20% of any given view — its rarity is what makes it read as intentional. Three supporting tints (`--brand-2/3/4`) step up in lightness for hover states, secondary emphasis, and off-range calendar tiles.

### Neutral
- **Ledger Paper** (`oklch(0.972 0.004 235)` — `--background`): the app's resting surface. A "dirty white," not a cream or a stark white.
- **Ledger Card** (`oklch(0.988 0.003 235)` — `--card`): sits one notch lighter than the page so cards read as raised without a shadow.
- **Ink** (`oklch(0.26 0.008 255)` — `--foreground`): body text.
- **Faint Rule** (`oklch(0.90 0.006 235)` — `--border`): hairline dividers and card outlines.
- **Muted Ash** (`oklch(0.945 0.005 235)` bg / `oklch(0.52 0.012 250)` text — `--muted` / `--muted-foreground`): secondary surfaces, disabled/secondary text. Never the color of body copy.

### Event & Status Vocabulary (theme-invariant)
- **Booked Teal** (`oklch(0.55 0.10 195)`): confirmed events — same hue as the brand accent, reinforcing "this is the primary, active thing."
- **Completed Green** (`oklch(0.55 0.13 145)`): finished events.
- **Cancelled Red** (`oklch(0.60 0.18 25)`, shared with `--destructive`): cancelled events, destructive actions, form errors.
- **Inquiry Slate** (`oklch(0.55 0.04 250)`): open inquiries — deliberately desaturated so it reads as "pending," not yet a commitment.
- **Onboarding Warm** (`oklch(0.975 0.014 85)`): the one deliberate exception — a warm amber-tinted backdrop scoped strictly to the first-run wizard, to make first contact feel inviting before the ledger discipline kicks in everywhere else.

### Named Rules
**The One Accent Rule.** Teal is the only color allowed to mean "act on this." It never appears decoratively — only on buttons, active states, focus rings, and the booked-event vocabulary.
**The Never-Pure Rule.** Backgrounds and text never hit true `#000`/`#fff`. Every neutral carries a faint cool tint (hue ~235 light / ~255 dark) so light and dark mode feel like the same product.

## 3. Typography

**Body & Display Font:** Plus Jakarta Sans (`var(--font-jakarta)`, fallback `system-ui, sans-serif`)

**Character:** One family carries the entire hierarchy through weight, size, and tracking — a deliberate choice for a tool that needs to feel coherent and unfussy, not editorial. Precision comes from restraint (tight letter-spacing on headlines, a consistent 14px body size) rather than a second display face.

### Hierarchy
- **Headline** (600, `clamp(1.5rem, 1.2rem + 1.2vw, 1.875rem)` / 24–30px, 1.2 line-height, -0.02em tracking): page-level `<h1>`s (Bookings, Teams, onboarding step titles).
- **Title** (600, 1.25rem/20px, 1.3 line-height, -0.01em tracking): dialog and auth-form headings, card titles.
- **Body** (400, 0.875rem/14px, 1.5 line-height): the default UI text size — table cells, form labels, descriptions. Caps prose at 65–75ch where it runs long.
- **Label** (500, 0.75rem/12px, 0.05em tracking, uppercase): table column headers, small status chips — the only place tracked uppercase type appears.

### Named Rules
**The One Voice Rule.** No second type family. Hierarchy is built from size, weight, and tracking on a single face — a serif or mono pairing would read as decoration this system doesn't want.

## 4. Elevation

Flat by design. Gallurio uses zero `box-shadow` on any core surface — cards and popovers separate from the page with a 1px `ring-foreground/10` hairline and a one-notch lightness shift (`--card` sits above `--background`), not a shadow. Depth is conveyed by tone and borders, matching the "instrument, not ornament" character. Interactive feedback (button press, day-cell hover) uses a 1–2px inset ring or a 1.5% scale-down rather than a shadow lift.

### Named Rules
**The Flat-By-Default Rule.** If you reach for `box-shadow` on an app surface, stop — use a hairline ring and a tonal shift instead. Shadows are reserved for true floating layers (dropdowns, tooltips) via the existing z-index scale, never for cards or panels at rest.

## 5. Components

Controls read as soft, considered instruments; structural frames read as sharp, disciplined ledger pages. That split — **soft controls, sharp frames** — is the system's core shape language.

### Buttons
- **Shape:** rounded controls (`0.25rem`, `--radius`). Smaller sizes (`xs`/`sm`) round slightly less (`~0.2rem`) so they don't look pill-like at small scale.
- **Primary:** `bg-primary` / `text-primary-foreground` — near-black/near-white, the default emphasis level for most actions.
- **Brand:** `bg-brand` / `text-brand-foreground` (Studio Teal) — reserved for the single most important action on a screen (submit, confirm, primary CTA).
- **Secondary / Outline / Ghost:** progressively quieter — tinted-neutral fill → bordered/transparent → no fill until hover. Destructive uses a translucent red fill (`destructive/10`), not a solid red block, keeping alarm proportionate.
- **Hover / Focus:** subtle opacity/tint shift on hover; focus-visible gets a 3px brand-tinted ring (`ring-3 ring-ring/50`) plus a matching border — the focus ring itself carries brand color, so keyboard navigation reinforces identity. Active press nudges the button down 1px instead of scaling.

### Badges
- **Style:** small (`h-5`), `rounded-md`, `text-xs font-medium`. Same variant ladder as buttons (default/secondary/destructive/outline/ghost) so status chips and buttons read as one visual grammar.

### Cards / Containers
- **Corner Style:** sharp (`0rem`, `--radius-surface`) — structural frames stay disciplined even where controls inside them are soft.
- **Background:** `--card`, one lightness notch above the page.
- **Shadow Strategy:** none — see Elevation. Separation comes from the `ring-foreground/10` hairline and the tonal shift only.
- **Internal Padding:** `1rem` default density, `0.75rem` in the compact (`size="sm"`) variant used in dense list contexts.

### Inputs / Fields
- **Style:** `2rem` height, `0.25rem` rounded, transparent background over a `border-input` hairline outline.
- **Focus:** border shifts to `--ring` plus the same 3px brand-tinted ring used on buttons — one consistent focus language across every interactive control.
- **Error / Disabled:** invalid state swaps the border/ring to destructive red; disabled drops opacity and fills faintly with `input/50`.

### Calendar / Events (signature component)
The calendar is Gallurio's most distinctive surface, restyled from react-big-calendar's defaults to match the ledger system: sharp-edged grid, hairline borders, muted-gray header row, and the teal "today" treatment (solid fill in month view, a 12%-opacity wash in week/day view so the whole column doesn't turn into one teal block). Events render as sharp-cornered candles colored by the event-status vocabulary (booked teal / completed green / cancelled red / inquiry slate) so status is legible at a glance without reading labels.

### Navigation
- **Style:** sidebar surface sits one notch off the page background; the active item is filled solid brand-teal (`--sidebar-primary`) — the one place in the nav where brand appears as a fill rather than an accent line. Hover states use the muted-neutral tint, keeping teal reserved for "this is where you are."

## 6. Do's and Don'ts

### Do:
- **Do** use Studio Teal (`--brand`) for exactly one primary action per view — CTA, active nav, or the "in progress right now" state.
- **Do** separate cards and panels with a `ring-1 ring-foreground/10` hairline and a one-step lightness shift, never a `box-shadow`.
- **Do** keep controls (buttons, inputs, badges) on the `0.25rem` control radius and structural frames (cards, dialogs, sidebar) at `0rem` — the soft-controls/sharp-frames split is load-bearing, not incidental.
- **Do** build hierarchy from Plus Jakarta Sans weight/size/tracking alone.

### Don't:
- **Don't** build a generic SaaS-cream dashboard: no gradient hero-metric cards, no glassmorphism, no cream/sand/parchment backgrounds standing in for "warm."
- **Don't** let the UI read as sterile enterprise/ERP software — no cold, over-dense corporate chrome.
- **Don't** clutter one view with competing badges, accents, or multiple "loud" colors at once — status colors (event vocabulary) are for the calendar, not for decorating arbitrary UI.
- **Don't** use `border-left`/`border-right` as a colored accent stripe on cards or list items.
- **Don't** mix in a second display typeface — the one-family system is deliberate.
- **Don't** apply drop shadows to cards, dialogs, or panels at rest.
