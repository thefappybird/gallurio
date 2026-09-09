---
name: Gallurio
description: Multi-tenant CRM for event businesses - bookings, calendar, clients, gallery, and public portfolios.
colors:
  background: "oklch(0.972 0.004 235)"
  foreground: "oklch(0.26 0.008 255)"
  card: "oklch(0.988 0.003 235)"
  card-foreground: "oklch(0.26 0.008 255)"
  popover: "oklch(0.988 0.003 235)"
  popover-foreground: "oklch(0.26 0.008 255)"
  primary: "oklch(0.28 0.008 255)"
  primary-foreground: "oklch(0.985 0.002 235)"
  secondary: "oklch(0.945 0.005 235)"
  secondary-foreground: "oklch(0.30 0.008 255)"
  muted: "oklch(0.945 0.005 235)"
  muted-foreground: "oklch(0.52 0.012 250)"
  accent: "oklch(0.945 0.005 235)"
  accent-foreground: "oklch(0.30 0.008 255)"
  border: "oklch(0.90 0.006 235)"
  input: "oklch(0.90 0.006 235)"
  ring: "oklch(0.60 0.10 195)"
  destructive: "oklch(0.577 0.245 27.325)"
  danger: "oklch(0.60 0.18 25)"
  brand: "oklch(0.55 0.10 195)"
  brand-foreground: "oklch(0.985 0 0)"
  brand-2: "oklch(0.65 0.10 195)"
  brand-3: "oklch(0.78 0.08 195)"
  brand-4: "oklch(0.88 0.05 195)"
  off-range: "oklch(0.85 0 0)"
  off-range-foreground: "oklch(0.2 0 0)"
  onboarding-bg: "oklch(0.975 0.014 85)"
  sidebar: "oklch(0.96 0.004 235)"
  sidebar-foreground: "oklch(0.26 0.008 255)"
  sidebar-accent: "oklch(0.93 0.006 235)"
  sidebar-accent-foreground: "oklch(0.26 0.008 255)"
  sidebar-border: "oklch(0.90 0.006 235)"
  event-booked: "oklch(0.55 0.10 195)"
  event-completed: "oklch(0.55 0.13 145)"
  event-cancelled: "oklch(0.60 0.18 25)"
  event-inquiry: "oklch(0.55 0.04 250)"
  chart-1: "oklch(0.55 0.10 195)"
  chart-2: "oklch(0.58 0.13 250)"
  chart-3: "oklch(0.68 0.14 60)"
  chart-4: "oklch(0.58 0.15 25)"
  chart-5: "oklch(0.55 0.14 300)"
  chart-6: "oklch(0.60 0.13 150)"
  chart-7: "oklch(0.66 0.12 95)"
  chart-8: "oklch(0.58 0.02 255)"
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
  card-title:
    fontFamily: "var(--font-jakarta), Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: "normal"
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
  control-md: "0.2rem"
  control-sm: "0.15rem"
  control-xl: "0.35rem"
  surface: "0rem"
spacing:
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
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
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "0 0.625rem"
    height: "2rem"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive}"
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
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.surface}"
    padding: "1rem"
  badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.control-md}"
    padding: "0.125rem 0.5rem"
    height: "1.25rem"
  nav-item-active:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand}"
    rounded: "{rounded.control-md}"
    padding: "0.5rem"
    height: "2rem"
---

# Design System: Gallurio

## Overview

**Creative North Star: "The Studio Ledger"**

Gallurio sits where creative work meets exact bookkeeping. An event business's calendar is full of shoots, weddings, and launches - messy, human, deadline-driven - but the tool that runs the business underneath has to be as precise as a ledger: every booking accounted for, every client record trustworthy, nothing left ambiguous. The interface reflects that split. It is quiet and neutral-cool at rest (an almost-white "dirty white" ground, never stark black/white), so the work itself - photos, client names, dates - carries the visual weight. One deliberate accent, a deep teal, marks what's actionable: primary buttons, the active nav item, today's date, a booked event. Everything else stays disciplined and gets out of the way.

The system runs at high density. The default control height is 32px, body copy is 14px, and card padding is 16px - a working instrument, not a showcase. Surfaces are flat and structural frames are sharp-cornered; depth in the resting UI comes from a one-notch tonal shift plus a hairline ring, never a shadow. Shadows exist, but only on things that genuinely float above the page and need to read as detached from it.

This system explicitly rejects the generic SaaS-cream dashboard look (gradient hero-metric tiles, glassmorphism, warm sand/parchment backgrounds, identical icon-card grids), sterile enterprise/legacy-ERP chrome, and visual clutter - competing badges and accents fighting for attention on one screen.

**Key Characteristics:**
- Neutral-cool "dirty white" / soft-charcoal base - never pure black or pure white.
- One brand accent (teal, hue 195) used sparingly and consistently for anything actionable.
- Flat resting surfaces: a `ring-1 ring-foreground/10` hairline does the job shadows would elsewhere. Only floating overlays carry a shadow.
- Controls are gently rounded; structural frames (cards, dialogs, sidebar) are sharp-cornered by default, and both are user-switchable through three radius presets.
- A theme-invariant event-status vocabulary (booked/completed/cancelled/inquiry) that reads identically in light and dark mode.
- Single type family, Plus Jakarta Sans, carrying the whole app hierarchy through weight and size, not font-pairing.
- Every token has a tuned dark-mode counterpart; the two schemes share a faint cool hue so they read as one product.

## Colors

A restrained, tinted-neutral palette (faint cool hue ~235 light / ~255 dark) with one committed accent, plus two small dedicated vocabularies: event status and data charts.

### Primary
- **Ledger Charcoal** (`--primary`, dark counterpart `oklch(0.90 0.004 235)`): default solid buttons, high-emphasis UI text. Near-black/near-white, never pure.

### Secondary
- **Studio Teal** (`--brand`, dark `oklch(0.70 0.12 195)`): the single deliberate accent. Brand CTAs, the active sidebar item, focus rings, today's date on the calendar, the "booked" event state. Caps at roughly 10-20% of any given view; its rarity is what makes it read as intentional. Three supporting tints (`--brand-2/3/4`) step through lightness for hover, secondary emphasis, and off-range surfaces. The tints invert direction between schemes - lighter in light mode, darker in dark mode - so each stays a step away from its own background.

### Tertiary
- **Chart Fan** (`--chart-1` through `--chart-8`): the only place multiple hues legitimately appear at once. `--chart-1` is the brand teal so the lead series stays on-brand; the rest fan out across indigo, amber, coral, violet, green, gold-olive, and a neutral slate at mid-luminance and moderate chroma, so several datasets read apart at a glance. Dark mode lifts lightness on all eight so they pop against charcoal.

### Neutral
- **Ledger Paper** (`--background`, dark `oklch(0.205 0.006 255)`): the app's resting surface. A "dirty white," not a cream or a stark white.
- **Ledger Card** (`--card` / `--popover`, dark `oklch(0.245 0.006 255)`): one notch lighter than the page in both schemes, so cards read as raised without a shadow either way.
- **Ink** (`--foreground`, dark `oklch(0.92 0.004 235)`): body text.
- **Faint Rule** (`--border` / `--input`, dark `oklch(1 0 0 / 12%)` and `oklch(1 0 0 / 16%)`): hairline dividers, card outlines, and field strokes. Dark mode switches from a solid tint to a translucent white so borders sit correctly on any dark surface.
- **Muted Ash** (`--muted` / `--accent` background, `--muted-foreground` text): secondary surfaces, hover fills, disabled and secondary text. `--muted` and `--accent` are deliberately the same value; hover states and quiet surfaces share one tone.
- **Sidebar Ground** (`--sidebar`, dark `oklch(0.235 0.006 255)`): the shell chrome, a half-step off `--background` so navigation separates from content without relying on a border. Carries its own foreground, accent, border, and ring tokens.
- **Off-range** (`--off-range` / `--off-range-foreground`): calendar tiles outside the visible month and other "context" cells. Theme-invariant, and its foreground is the tile's own text color, not the page foreground.

### Status
- **Booked Teal** (`--event-booked`): confirmed events - the same value as the brand accent, reinforcing "this is the primary, active thing."
- **Completed Green** (`--event-completed`): finished events.
- **Cancelled Red** (`--event-cancelled`, aliased to `--danger`): cancelled events, scheduling conflicts.
- **Inquiry Slate** (`--event-inquiry`): open inquiries - deliberately desaturated so it reads as "pending," not yet a commitment.
- **Destructive** (`--destructive`, dark `oklch(0.704 0.191 22.216)`): destructive actions and form errors. Distinct from `--danger`: `--destructive` is the interactive/error token and shifts between schemes, while `--danger` is the theme-invariant calendar red.
- **Toast palette** (`--success-*`, `--error-*`, `--warning-*`, `--info-*`): a background/text/border triplet per status, defined for both schemes, consumed by Sonner's rich colors. Light mode pairs a pale tinted background with deep tinted text; dark mode inverts it. These exist only for toasts.
- **Onboarding Warm** (`--onboarding-bg`, dark `oklch(0.235 0.010 75)`): the one deliberate exception to the cool ramp - a warm amber-tinted backdrop scoped strictly to the first-run wizard's outer wrapper, so first contact feels inviting before the ledger discipline takes over. Dark mode uses a faintly warm charcoal rather than a literal cream, which would fail contrast.

### Named Rules
**The One Accent Rule.** Teal is the only color allowed to mean "act on this." It never appears decoratively - only on buttons, active states, focus rings, the lead chart series, and the booked-event vocabulary.

**The Never-Pure Rule.** Backgrounds and text never hit true `#000`/`#fff`. Every neutral carries a faint cool tint (hue ~235 light, ~255 dark) so light and dark mode feel like the same product. This rule governs the app shell; the shipped portfolio presets carry their own version of it, documented under Components.

**The Theme-Invariant Status Rule.** Event colors and `--off-range` hold the same value in both schemes. A calendar must not change its status vocabulary when a user flips the theme; a saturated mid-luminance value that carries white text is chosen precisely so one value works on both grounds.

## Typography

**Display & Body Font:** Plus Jakarta Sans (`var(--font-jakarta)`, fallback `Plus Jakarta Sans, system-ui, sans-serif`)
**Mono Font:** system stack (`ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`) - used only where character alignment is functional, never for display.

`--font-heading` is aliased to `--font-sans`. The alias is the commitment: headings are not a separate face, and the seam exists only so a future change would be a one-line change.

**Character:** One family carries the entire hierarchy through weight, size, and tracking - a deliberate choice for a tool that needs to feel coherent and unfussy, not editorial. Precision comes from restraint (tight letter-spacing on headlines, a consistent 14px body size) rather than a second display face.

### Hierarchy
- **Headline** (600, `clamp(1.5rem, 1.2rem + 1.2vw, 1.875rem)` / 24-30px, 1.2 line-height, -0.02em tracking): page-level `h1`s (Bookings, Teams, onboarding step titles).
- **Title** (600, 20px, 1.3 line-height, -0.01em tracking): dialog and auth-form headings.
- **Card Title** (500, 16px, 1.375 line-height; 14px in a `data-size="sm"` card): card headings. Deliberately lighter and smaller than Title - a card heading labels a region, it does not open one.
- **Body** (400, 14px, 1.5 line-height): the default UI text size - table cells, form labels, descriptions, dialog and card bodies. Caps prose at 65-75ch where it runs long.
- **Label** (500, 12px, 0.05em tracking, uppercase): table column headers and small status chips - the only place tracked uppercase type appears.

Inputs are the one intentional exception to the 14px default: they render at 16px below the `md` breakpoint and 14px at and above it, because iOS Safari zooms the viewport on focus for anything under 16px.

### Named Rules
**The One Voice Rule.** No second type family in the application shell. Hierarchy is built from size, weight, and tracking on a single face; a serif or mono pairing would read as decoration this system doesn't want. The shipped portfolio presets are governed separately - see Components.

## Layout

The app is a persistent-sidebar shell: a 16rem sidebar (4rem collapsed to an icon rail, 18rem as an off-canvas sheet on mobile) beside a fluid content column. Content is not centered in a fixed container; it fills the column, because the primary surfaces are tables and calendars that benefit from width.

Density is the defining spatial property. The base control height is 2rem, with a 1.75rem small step and a 2.25rem large step; card padding is 1rem, dropping to 0.75rem at `data-size="sm"`; the standard gap between stacked card sections is 1rem. This is a working density, not a marketing density - assume real screens carry twenty rows, not four.

Responsive behavior is verified at three widths - 375px, 768px, and 1280px - across all five locales and both themes. Mobile is not a scaled-down desktop: the sidebar becomes a sheet, tables become stacked records, and large flows use steps or tabs rather than tall modals.

Arabic is a first-class direction, not an afterthought. Every spatial utility is logical (`ms/me`, `ps/pe`, `start/end`, `text-start`), never physical (`ml/mr`, `pl/pr`, `text-left`). Components carry direction-aware data attributes (`data-[side=inline-start]`, `data-[icon=inline-end]`) so popovers and icon padding flip with the document, and RTL geometry is checked to stay inside its container rather than assumed correct.

## Elevation & Depth

The resting interface is flat. Cards, dialogs, and the sidebar carry no `box-shadow` at all: they separate from the page with a 1px `ring-foreground/10` hairline plus a one-notch lightness shift (`--card` sits above `--background`). Depth is conveyed by tone and borders, matching the "instrument, not ornament" character.

Shadows exist for exactly one job: marking things that genuinely float free of the document and can land over arbitrary content. Menus, popovers, selects, sheets, and toasts get one. A dialog does not, because its own backdrop already detaches it.

### Shadow Vocabulary
- **Floating menu** (`shadow-md`): dropdown menus, popovers, select listboxes. Paired with `ring-1 ring-foreground/10` on menus so the edge stays defined on any background.
- **Floating panel** (`shadow-lg`): sheets, toasts, and dropdown submenus - larger surfaces that travel further from their trigger.
- **Ring-as-shadow** (`shadow-[0_0_0_1px_var(--sidebar-border)]`): the outline sidebar-menu-button variant, where a shadow draws a hairline that does not affect layout. It shifts to `--sidebar-accent` on hover.
- **Chrome lift** (`shadow-sm`): only the floating and inset sidebar variants, which are detached shell chrome rather than content.

### Interaction Depth
- **Press:** `active:translate-y-px` on buttons - a one-pixel physical drop, not a scale or a shadow change. Suppressed on buttons that open a menu (`aria-haspopup`), because the popup is the feedback.
- **Focus:** a 3px brand-tinted ring (`focus-visible:ring-3 ring-ring/50`) plus a solid `border-ring` edge. Focus is the one state allowed to introduce the accent on an otherwise neutral control. Brand and destructive variants swap the ring to their own hue.
- **Dialog backdrop:** `bg-black/10` with `backdrop-blur-xs` where supported - a light scrim and a slight defocus, not a heavy dim.

### Named Rules
**The Flat-Content Rule.** If it is part of the page, it is flat: hairline ring plus tonal shift. If it floats over the page and could land on anything, it gets a shadow. There is no third case, and no shadow ever appears on a card.

**The Hairline Rule.** `ring-1 ring-foreground/10` is the standard separator for a raised surface. It is a ring, not a border, so it never participates in layout or shifts content by a pixel.

## Shapes

Two independent radius axes, and the split is the point:

- `--radius` governs **controls**: buttons, inputs, badges, menus, tabs, switches. Default 0.25rem - softened, hand-friendly.
- `--radius-surface` governs **structural frames**: cards, dialogs, the sidebar, tables, panels. Default 0rem - sharp, ledger-like.

Soft controls in sharp frames is the signature geometry. It reads as precise paper with tactile instruments sitting on it.

A derived scale hangs off `--radius` for components that must stay proportional as the axis changes: `sm` 0.6x, `md` 0.8x, `lg` 1x, `xl` 1.4x, `2xl` 1.8x, `3xl` 2.2x, `4xl` 2.6x. Small controls additionally clamp against a pixel ceiling (`rounded-[min(var(--radius-md),10px)]`) so a rounded preset cannot turn a 24px button into a pill.

Both axes are user-switchable through `html[data-radius]`, set from the typed app-theme config:

- **sharp** - `--radius: 0`, `--radius-surface: 0`. Fully squared.
- **subtle** (default) - `--radius: 0.25rem`, `--radius-surface: 0`. The shipped look.
- **rounded** - `--radius: 0.5rem`, `--radius-surface: 0.5rem`. Frames soften along with controls.

These blocks sit outside `:root`/`.dark` because corner style is scheme-independent.

### Named Rules
**The Two-Axis Rule.** Never hardcode a corner. A control reads `--radius` (or its derived step); a frame reads `--radius-surface`. A literal `rounded-md` on a card breaks the sharp preset silently, because nothing errors - it just stops responding to the user's choice.

## Components

Primitives are built on **Base UI** (`@base-ui/react`), styled with Tailwind v4 and `class-variance-authority` variants. Components expose `data-slot` attributes for targeting and use `data-*` state selectors (`data-open`, `data-active`, `data-size`) rather than class toggling.

### Buttons
- **Shape:** control radius (`rounded-lg` resolves to `--radius`, 0.25rem at the default preset). Small sizes clamp to `min(--radius-md, 10-12px)`.
- **Sizes:** `xs` 1.5rem, `sm` 1.75rem, `default`/`icon` 2rem, `lg`/`icon-lg` 2.25rem. Horizontal padding 0.625rem, tightening to 0.5rem beside an inline icon.
- **default:** solid `--primary` on `--primary-foreground`. The workhorse; hover applies only when it is a link.
- **brand:** solid `--brand` on `--brand-foreground`, hover at 90% opacity, focus ring swapped to `--brand`. Reserved for the single most important action on a surface.
- **outline:** `--background` fill with a `--border` stroke, hover to `--muted`. Dark mode switches to a translucent `--input` fill instead of a stroke.
- **secondary / ghost:** `--secondary` fill or transparent, both hovering to a muted tone. Ghost is the default for icon-only actions in dense rows.
- **destructive:** a tinted well, not a solid block - `bg-destructive/10` with `text-destructive`, deepening to 20% on hover. Destructive intent is signalled by hue, not by mass, so a delete button never outweighs the primary action beside it.
- **link:** `--primary` text with an offset underline on hover.
- **States:** `active:translate-y-px` press (suppressed when the button owns a popup), `focus-visible` 3px ring, `disabled:opacity-50` with `cursor-not-allowed`, and a built-in `loading` prop that swaps in a size-matched spinning `Loader2` and sets `aria-busy`.

### Inputs / Fields
- **Style:** 2rem tall, transparent fill, `--input` stroke, control radius, 0.625rem horizontal padding. Dark mode adds a faint `input/30` fill so fields read against the charcoal ground.
- **Focus:** `border-ring` plus a 3px `ring-ring/50` - the brand teal, so focus itself reinforces the accent.
- **Invalid:** `aria-invalid` drives a `--destructive` border and a 3px destructive ring. Never color alone: an error message accompanies it.
- **Disabled:** 50% opacity, `--input/50` fill, pointer events off.
- **Size:** 16px text below `md`, 14px at and above, to defeat iOS focus zoom.

### Cards / Containers
- **Corner Style:** `--radius-surface` (0rem default), applied to the card and echoed on first/last child images and the footer so clipping stays consistent under a rounded preset.
- **Background:** `--card` on `--card-foreground`.
- **Separation:** `ring-1 ring-foreground/10`. No shadow, ever.
- **Padding:** 1rem vertical and horizontal, dropping to 0.75rem at `data-size="sm"`.
- **Footer:** a `--muted/50` band with a top border, flush to the card edge.

### Badges
- **Style:** 1.25rem tall, `--radius-md`, 0.5rem horizontal padding, 12px medium text. Same variant vocabulary as buttons (default, secondary, destructive, outline, ghost, link) so a badge and a button describing the same state agree in color.
- **Behavior:** hover styles apply only when the badge renders as a link (`[a]:hover`), so a static status chip never pretends to be interactive.

### Navigation
- **Sidebar:** `--sidebar` ground, 16rem wide, collapsing to a 4rem icon rail or an 18rem mobile sheet.
- **Item:** 2rem tall, `rounded-md`, 0.5rem padding, 14px text, 1rem icon. Hover fills `--sidebar-accent`.
- **Active:** `bg-brand/12` with `text-brand` and medium weight - a teal wash, not a solid fill. The wash is quiet enough to sit in a list of ten items without shouting, and pairing color with a weight shift means state is never signalled by color alone.
- **Sub-item:** 1.75rem tall, same active treatment, offset by one pixel so the two levels align optically.

### Overlays (Dialog, Sheet, Menu, Popover, Toast)
- **Dialog:** centered, `--radius-surface`, `--popover` fill, `ring-1 ring-foreground/10`, 1rem padding, `max-w-sm` at `sm` and up. Enters with a 100ms fade plus `zoom-in-95`. Backdrop is `bg-black/10` with `backdrop-blur-xs`.
- **Menus / Selects / Popovers:** control radius, `--popover` fill, `shadow-md`, 1px hairline, and a `--transform-origin` anchored animation that slides 2px from the trigger's side.
- **Sheet:** edge-anchored, `shadow-lg`, translating 2.5rem from its own edge on enter and exit; 75% width on mobile, capped at `sm` on desktop.
- **Toast:** `--popover` fill, `shadow-lg`, control radius, entering on the custom `toast-in` animation (280ms, `cubic-bezier(0.16, 1, 0.3, 1)`). Rich colors resolve to the dedicated toast palette.

### Motion
Motion is short, purposeful, and always reversible. The vocabulary is deliberately small:

- **State transitions:** 100ms on overlays, 200ms on hover and color changes. Default easing.
- **`toast-in`** (280ms, `cubic-bezier(0.16, 1, 0.3, 1)`): the one expressive curve, a fast settle used where something arrives unprompted.
- **`shake`** (380ms, `ease-in-out`): rejected input.
- **`bell-nudge`** (600ms, `ease-in-out`): a new notification arriving in the header bell.
- **`theme-tile-invalid-glow`** (650ms, `ease-out`): an invalid theme selection in the portfolio editor.
- **`marquee-scroll`** (28s, `linear`, infinite): the one ambient, non-reactive animation.

Every keyframe animation is paired with a `prefers-reduced-motion: reduce` block that sets `animation: none`. This is not optional - a new animation without its reduced-motion counterpart is an incomplete animation.

### Portfolio Theme Presets (signature)

Gallurio ships six brand-kit presets that seed a tenant's public portfolio. They are the product's own design opinion, rendered as a starting point; once applied, the owner may change anything, and their result is theirs, not this system's concern. What this system owns is the quality and coherence of the six presets themselves.

Each preset is a complete brand kit - five colors (primary, secondary, accent, background, foreground), a heading font, a body font, a radius step, and a button style - resolved into `--pf-*` custom properties on the public page wrapper. There are no partial presets: selecting one replaces the whole kit, so the preview can never show a half-applied state.

| Preset | Heading / Body | Ground | Accent | Radius | Button |
|---|---|---|---|---|---|
| Minimal | Merriweather / Merriweather | `#fcfcfb` near-white | `#2f5d56` deep pine-teal | sharp | solid |
| Editorial | Playfair Display / Inter | `#fbf9f6` warm paper | `#7e6a52` bronze | sharp | solid |
| Luxury | Cormorant / Montserrat | `#0e0e0e` near-black | `#c9a86a` gold | sharp | outline |
| Bold | Montserrat / Inter | `#fbfbfc` cool near-white | `#1f3a5f` deep navy | sharp | solid |
| Romantic | Cormorant / DM Sans | `#fcf6f4` blush paper | `#8a5555` deep dusty rose | subtle | soft |
| Modern | DM Serif Display / DM Sans | `#f7f7f5` cool paper | `#4a3a5c` deep aubergine | subtle | solid |

The presets are how Gallurio's taste reaches a surface it does not control, so they carry the app's own discipline outward: one accent per preset, muted and desaturated rather than bright; near-black rather than black for text and near-white rather than white for grounds; sharp corners as the default and `rounded` never shipped; and a display face paired with a quiet grotesque so the portfolio's own images stay the loudest thing on the page. `#2f5d56` is the deliberate through-line back to Gallurio's teal - a preset accent may be warm, but it is never a saturated primary.

Minimal is also the default brand kit: a workspace that never opens the Theme panel renders with exactly that preset, which is why the two definitions are kept identical.

### Named Rules
**The Preset Quality Bar.** A shipped preset is a finished design, not a swatch set. Before it ships: foreground-on-background clears 4.5:1; the accent clears 4.5:1 against its own ground; and if the button style is `solid`, the button's label color clears 4.5:1 against the accent. An accent that only works as an outline button ships only with `buttonStyle: "outline"` - as Luxury's gold does, since white on `#c9a86a` measures 2.26:1 and would fail as a solid. The bar is enforced in `themePresetDefinitions.test.ts`, not by eye.

**The Preset Distinction Rule.** Each preset must be identifiable at a glance from its ground, accent, and type pairing together. Two presets sharing an accent value is a defect, not a coincidence.

**The Owner's Page Rule.** Presets are Gallurio's design; everything the owner does afterwards is not. Do not add validation, nudges, or "corrections" that push a tenant's chosen colors back toward this system. The public page is the owner's to get wrong.

## Do's and Don'ts

### Do:
- **Do** reach for a semantic token (`bg-card`, `text-muted-foreground`, `ring-border`) rather than a literal color. Both schemes, both radius axes, and all future theming flow through them.
- **Do** use `--radius` on controls and `--radius-surface` on frames, so a change of corner preset moves the whole UI coherently.
- **Do** separate a raised surface with `ring-1 ring-foreground/10` and a tonal step.
- **Do** reserve the brand teal for action and active state: brand buttons, the active nav item, focus rings, today's date, booked events, and the lead chart series.
- **Do** pair every color signal with a second cue - an icon, a label, a weight shift - so state survives both color-blindness and grayscale.
- **Do** ship a `prefers-reduced-motion` counterpart with every keyframe animation.
- **Do** use logical direction utilities (`ms/me`, `ps/pe`, `start/end`) everywhere, and verify Arabic geometry rather than assuming it.
- **Do** build all four async states (loading, empty, error, populated) and all five control states (idle, hover, focus-visible, active, disabled) for every surface.
- **Do** hold 14px body and 2rem controls as the default density. If a screen needs more room, cut content, not scale.

### Don't:
- **Don't** put a `box-shadow` on a card, a dialog, or any in-page surface. Shadows belong to floating overlays only.
- **Don't** use pure `#000` or `#fff` for a background or for text in the app shell.
- **Don't** introduce a second type family into the application. Hierarchy comes from size, weight, and tracking on Plus Jakarta Sans.
- **Don't** hardcode a corner radius, a control height, or a hex value; all three are user-switchable axes in disguise.
- **Don't** spend the teal on decoration - a colored heading, a tinted background band, an icon with no action behind it. Past roughly 20% of a view it stops meaning "act on this."
- **Don't** change an event-status color between light and dark mode. That vocabulary is theme-invariant by design.
- **Don't** use physical direction utilities (`ml/mr`, `pl/pr`, `text-left`, `left-0`) in any component that renders under Arabic.
- **Don't** signal a state with color alone, and don't let a status chip carry hover styling unless it is genuinely a link.
- **Don't** ship a portfolio preset that fails the contrast bar, duplicates another preset's accent, or defaults to the `rounded` radius.
