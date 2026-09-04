# Portfolio template + palette exploration

Build spec for the next generation of starter templates. **18 template ideas** (3 per theme × 6 themes), **18 candidate palettes** (3 per theme), a **featured-work popup + contact modal config per template**, and **four layout renditions each for the featured-work popup and the view-image modal**, for hand-recreation in the portfolio builder.

Companion visual: <https://claude.ai/code/artifact/e9f1ee87-cfa7-41fa-bfa6-8fef8f63249a> renders every palette on a mock section stack in that theme's real fonts, with a Modals view for the two per-template overlays and a Renditions view for the gallery layout options.

## How this is meant to be used

1. Pick **one palette winner per theme** — it replaces that theme's entry in `THEME_PRESET_DEFINITIONS`.
2. Pick **one template winner per theme** (or keep more than one) — recreate it in the builder, save it as a draft, and hand the draft to the agent that rewrites `lib/page-builder/templates/*`.
3. The three palettes per theme are shared across that theme's three templates, so a template can be judged against all three grounds without confounding the comparison.

## Constraints these were designed against

Every palette below was validated against the real preset compositions with the same contrast maths `lib/page-builder/blocks/presetContrast.test.ts` uses. The binding contract:

- The single `foregroundColor` must clear **4.5:1** against `background`, `primary`, `secondary` **and** `accent`. This is why every light palette's three colour slots are tints and every dark palette's are shades — there is no room for a mid-tone in any slot.
- Solid button fills must clear **3:1** against the band they sit on.
- No pure `#ffffff` / `#000000` (the app's Never-Pure discipline, enforced in `themePresetDefinitions.test.ts`).
- `primary` and `accent` must differ (the 2-swatch theme thumbnail depends on it).

**All 18 pass.** Re-run the check after any hex edit — a one-digit change can drop a band below AA.

Fonts, radius and button style are **unchanged per theme**; these variants explore colour only. The theme's identity (Merriweather-only for Minimal, Cormorant + Montserrat for Luxury, etc.) is what makes a palette read as that theme.

## Vocabulary

A template is two Puck zones — `home` and `gallery`. There is no contact *page*; contact is the modal, configured through `defaultContact`. Every zone opens with the pinned `Navigation` and closes with a footer preset.

Recipes below name preset keys from `lib/page-builder/blocks/sectionPresets.ts` exactly. `→ band` notes the section's `bgColorToken` where it differs from the page ground, because band rhythm is what separates these templates from each other more than block choice does.

---

# Minimal

Merriweather throughout · sharp radius · solid buttons. White-cube discipline: the photograph is the only saturated thing on the page.

## Palettes

### M-A · Salt Flat
Near-neutral cool greys. The most gallery-like of the three — colour recedes so far it reads as light, not hue. Best for photographers whose work is already high-chroma.

| slot | hex |
|---|---|
| background | `#fbfbfc` |
| foreground | `#1a1d22` |
| primary | `#e3e7ec` |
| secondary | `#eef0f3` |
| accent | `#ccd5de` |

### M-B · Paper Weight
Warm oatmeal and bone. Analogue, printed, slightly aged. Softer than the current sage default without becoming Editorial.

| slot | hex |
|---|---|
| background | `#fcfaf6` |
| foreground | `#1f1c16` |
| primary | `#ece5d8` |
| secondary | `#f5f1e8` |
| accent | `#ddd0ba` |

### M-C · Cold Green
Pale eucalyptus — the current theme's sage, pushed cooler and cleaner. Keeps the existing personality but stops it reading as beige-adjacent.

| slot | hex |
|---|---|
| background | `#f9fbfa` |
| foreground | `#16211c` |
| primary | `#dce9e2` |
| secondary | `#eaf1ed` |
| accent | `#c2d9cf` |

## Templates

### MIN-1 · White Cube
*Fine-art and gallery photographers.* No hero image at all — an oversized line of type, then work. The bravest of the three and the one that most needs strong photographs.

- **Home:** `Navigation` · `HeroStatementPreset` · `GalleryGridFramedPreset` · `AboutPreset` · `CtaMinimalPreset` → primary band · `FooterSignaturePreset`
- **Gallery:** `Navigation` · `GalleryLandingMastheadPreset` · `GalleryMasonryWallPreset` · `FooterSignaturePreset`
- **Rhythm:** one band only, at the close. Everything above it sits on the page ground.
- **Needs:** gallery images.

### MIN-2 · Contact Sheet
*Working portrait photographer.* Denser and more transactional — collections index, priced menu, contact bar. The one that converts hardest.

- **Home:** `Navigation` · `HeroSplitPreset` · `FeaturedWorkIndexPreset` → secondary band · `ServicesMenuPreset` · `ContactBarPreset` → primary band · `FooterDirectoryPreset`
- **Gallery:** `Navigation` · `GalleryLandingSplitPreset` · `GalleryGridFullPreset` · `FooterDirectoryPreset`
- **Rhythm:** ground / band / ground / band — a steady alternation that keeps a long page legible.
- **Needs:** collections, contact details, gallery images.

### MIN-3 · Quiet Room
*Planner or stylist who leads with words.* One immersive image, then long-form copy and a single featured service.

- **Home:** `Navigation` · `HeroPreset` · `AboutPortraitPreset` · `ServicesFeaturePreset` · `CtaImagePreset` · `FooterSignaturePreset`
- **Gallery:** `Navigation` · `GalleryLandingPreset` · `GalleryMasonryPreset` · `CtaMinimalPreset` → accent band · `FooterSignaturePreset`
- **Rhythm:** no bands on Home — images do the separating. The gallery's closing accent band is the page's only colour event.
- **Needs:** gallery images.

---

# Editorial

Playfair Display + Inter · sharp radius · solid buttons. Magazine structure: rules, columns, and a masthead voice.

## Palettes

### E-A · Newsprint
Warm greys with one cool ink-blue accent. Broadsheet, not glossy. The accent is the only cool note on the page, so a button placed on it genuinely draws the eye.

| slot | hex |
|---|---|
| background | `#f7f6f3` |
| foreground | `#1b1a18` |
| primary | `#e4e2dc` |
| secondary | `#efeee9` |
| accent | `#c9cfd8` |

### E-B · Ink & Ochre
Mustard and bone — the current camel palette turned up. Warmer and more confident than today's default; reads as a design annual rather than a wedding blog.

| slot | hex |
|---|---|
| background | `#faf7f0` |
| foreground | `#201c12` |
| primary | `#ecdfc0` |
| secondary | `#f4ecd9` |
| accent | `#dcc78e` |

### E-C · Cold Press
Blue-grey with a blush secondary. The most contemporary of the three — fashion-magazine rather than heritage-print.

| slot | hex |
|---|---|
| background | `#f8f8f9` |
| foreground | `#191a1d` |
| primary | `#dfe3e8` |
| secondary | `#f0e8e6` |
| accent | `#cbd3da` |

## Templates

### ED-1 · Masthead
*Wedding photographer.* Type-led opening, studio profile, and a journal spread where the introduction holds one column while the images take the rest.

- **Home:** `Navigation` · `HeroStatementPreset` · `AboutProfilePreset` · `GalleryMasonryJournalPreset` · `ServicesMenuPreset` → secondary band · `CtaPreset` → accent band · `FooterStatementPreset` → primary band
- **Gallery:** `Navigation` · `GalleryLandingMastheadPreset` · `GalleryMasonryJournalPreset` · `FooterStatementPreset` → primary band
- **Rhythm:** three consecutive bands close the page, each a step darker in weight. The bottom third is where the colour lives.
- **Needs:** gallery images.

### ED-2 · Feature Story
*Documentary photographer or film-maker.* Video sits second, before the biography — the film is the lede.

- **Home:** `Navigation` · `HeroPreset` · `VideoSplitPreset` · `AboutPreset` · `FeaturedWorkLeadPreset` · `ContactSplitPreset` → secondary band · `FooterDirectoryPreset`
- **Gallery:** `Navigation` · `GalleryLandingSplitPreset` · `GalleryGridPreset` · `VideoCinemaPreset` → primary band · `FooterDirectoryPreset`
- **Rhythm:** page ground the whole way down until the contact band. The gallery's cinema band is the one dark moment.
- **Needs:** video, collections, contact details, gallery images.

### ED-3 · Column Inch
*Event planner.* The most text-forward template in the set — priced menu above the fold-and-a-half, framed selection instead of a wall of images.

- **Home:** `Navigation` · `HeroSplitPreset` · `ServicesMenuPreset` · `AboutProfilePreset` → secondary band · `GalleryGridFramedPreset` · `CtaMinimalPreset` → accent band · `FooterDirectoryPreset`
- **Gallery:** `Navigation` · `GalleryLandingMastheadPreset` · `GalleryMasonryPreset` · `ContactBarPreset` → primary band · `FooterSignaturePreset`
- **Rhythm:** bands wrap the two long text sections so they read as pull-outs rather than filler.
- **Needs:** contact details, gallery images.

---

# Luxury

Cormorant Garamond + Montserrat · sharp radius · outline buttons · **dark ground**. Restraint and space; the outline button is the whole button system, so it must never sit on a band that swallows it.

## Palettes

### L-A · Obsidian & Brass
Black with a green undertone, warm brass accent. Closest to the current default but deeper and less brown — the bronze reads as metal rather than as mud.

| slot | hex |
|---|---|
| background | `#0b0d0c` |
| foreground | `#f2ede1` |
| primary | `#2a2620` |
| secondary | `#1d211f` |
| accent | `#4a3a1e` |

### L-B · Midnight Sapphire
Blue-black with indigo shades and a cool platinum foreground. The most modern of the three; reads editorial-luxury rather than hotel-luxury.

| slot | hex |
|---|---|
| background | `#0a0c11` |
| foreground | `#eceef4` |
| primary | `#1e2431` |
| secondary | `#262b38` |
| accent | `#2f3a52` |

### L-C · Oxblood
Deep burgundy shades on a warm near-black. The most dramatic, and the one with an obvious point of view — best for a studio that wants to be remembered rather than trusted.

| slot | hex |
|---|---|
| background | `#100c0d` |
| foreground | `#f4e9e7` |
| primary | `#2c1a1d` |
| secondary | `#241a1b` |
| accent | `#4a2027` |

## Templates

### LUX-1 · Private View
*High-end wedding photographer.* Five sections, nothing more. Immersive cover, a short statement, two lead collections, one invitation.

- **Home:** `Navigation` · `HeroPreset` · `AboutPreset` · `FeaturedWorkLeadPreset` · `CtaPreset` → accent band · `FooterStatementPreset` → primary band
- **Gallery:** `Navigation` · `GalleryLandingPreset` · `GalleryMasonryWallPreset` · `FooterStatementPreset` → primary band
- **Rhythm:** the shortest home page in the set. Space is the luxury signal; resist adding a sixth section.
- **Needs:** collections, gallery images.

### LUX-2 · Atelier
*Stylist, couture, or makeup artist.* Portrait-led, one featured service carrying the price conversation, a framed selection rather than a grid.

- **Home:** `Navigation` · `HeroSplitPreset` · `AboutPortraitPreset` · `ServicesFeaturePreset` → secondary band · `GalleryGridFramedPreset` · `ContactSplitPreset` → primary band · `FooterDirectoryPreset`
- **Gallery:** `Navigation` · `GalleryLandingSplitPreset` · `GalleryGridPreset` · `CtaImagePreset` · `FooterSignaturePreset`
- **Rhythm:** two bands, both mid-page, so the top and bottom stay on the deep ground.
- **Needs:** contact details, gallery images.

### LUX-3 · Cinema
*Videographer or entertainer.* The film runs full width on a contrasting band immediately under a typographic opening.

- **Home:** `Navigation` · `HeroStatementPreset` · `VideoCinemaPreset` → primary band · `AboutProfilePreset` · `ServicesMenuPreset` · `CtaMinimalPreset` → accent band · `FooterStatementPreset` → secondary band
- **Gallery:** `Navigation` · `GalleryLandingMastheadPreset` · `VideoPreset` · `GalleryMasonryPreset` · `FooterSignaturePreset`
- **Rhythm:** band at the top for the film, band at the bottom for the ask — the middle is unbroken ground for reading.
- **Needs:** video, gallery images.

---

# Bold

Montserrat + Inter · sharp radius · solid buttons. Colour blocks are the point; this is the only theme where the palette is meant to be noticed before the photographs.

## Palettes

### B-A · Signal
Pale electric blue, soft red-orange, and a real yellow accent. The most legible-loud of the three — the yellow is the strongest single hue anywhere in the set and still clears AA under the navy foreground.

| slot | hex |
|---|---|
| background | `#fcfcfd` |
| foreground | `#0d1420` |
| primary | `#c9dcff` |
| secondary | `#ffd6cc` |
| accent | `#ffe066` |

### B-B · Court
Mint, coral, lemon. Sportier and more playful; suits entertainers and event production over wedding work.

| slot | hex |
|---|---|
| background | `#fbfdfc` |
| foreground | `#0e1a16` |
| primary | `#c4ead8` |
| secondary | `#ffd5cb` |
| accent | `#f6e27a` |

### B-C · Risograph
Lilac, pink, ochre — a printed-poster palette. The most fashion-adjacent option and the biggest departure from the current pastel blue default.

| slot | hex |
|---|---|
| background | `#fdfcfd` |
| foreground | `#16101f` |
| primary | `#dcd0f5` |
| secondary | `#fbd3e0` |
| accent | `#f5cf87` |

## Templates

### BLD-1 · Poster
*Entertainer, DJ, event host.* Statement type, a compact project index on a band, three priced cards, and an accent-band close.

- **Home:** `Navigation` · `HeroStatementPreset` · `FeaturedWorkIndexPreset` → primary band · `ServicesPreset` · `CtaPreset` → accent band · `FooterStatementPreset` → secondary band
- **Gallery:** `Navigation` · `GalleryLandingMastheadPreset` · `GalleryGridFullPreset` · `CtaPreset` → accent band · `FooterStatementPreset` → secondary band
- **Rhythm:** every second section is a different colour. This is the template that proves the palette.
- **Needs:** collections, gallery images.

### BLD-2 · Rate Card
*Commercial or brand photographer.* Services immediately after the split hero — the buyer is comparing packages, not browsing.

- **Home:** `Navigation` · `HeroSplitPreset` · `ServicesFeaturePreset` → secondary band · `GalleryGridPreset` · `AboutProfilePreset` · `ContactBarPreset` → primary band · `FooterDirectoryPreset`
- **Gallery:** `Navigation` · `GalleryLandingSplitPreset` · `GalleryMasonryWallPreset` · `FooterDirectoryPreset`
- **Rhythm:** bands bracket the work — services above, contact below, photographs on clean ground between.
- **Needs:** contact details, gallery images.

### BLD-3 · Showreel
*Video and event production.* Film on a full-width band second, then collections and a menu.

- **Home:** `Navigation` · `HeroPreset` · `VideoCinemaPreset` → primary band · `FeaturedWorkPreset` · `ServicesMenuPreset` → secondary band · `CtaImagePreset` · `FooterSignaturePreset`
- **Gallery:** `Navigation` · `GalleryLandingPreset` · `GalleryGridFramedPreset` · `VideoSplitPreset` → secondary band · `FooterSignaturePreset`
- **Rhythm:** the two heaviest sections (film, menu) each get a band; the image sections stay on ground so nothing competes with them.
- **Needs:** video, collections, gallery images.

---

# Romantic

Cormorant Garamond + DM Sans · subtle radius · soft buttons. The only theme with rounded edges and translucent fills — the palette should stay soft enough that a 15% wash still reads.

## Palettes

### R-A · Dried Petal
Mauve and taupe. The current dusty rose, matured — less confectionery, more pressed-flower.

| slot | hex |
|---|---|
| background | `#fdf9f8` |
| foreground | `#2e2126` |
| primary | `#e6d3d6` |
| secondary | `#f1e6e2` |
| accent | `#d3b6bb` |

### R-B · Wisteria
Lilac with a pale sage secondary. Garden rather than boudoir; the green stops the page reading as uniformly pink.

| slot | hex |
|---|---|
| background | `#fbfaf9` |
| foreground | `#26202c` |
| primary | `#ddd2ea` |
| secondary | `#e6ece1` |
| accent | `#c7bade` |

### R-C · Terracotta Bloom
Warm clay and apricot. Sun-faded and Mediterranean — the option that works for a caterer or venue as readily as a photographer.

| slot | hex |
|---|---|
| background | `#fdfaf6` |
| foreground | `#2e1f18` |
| primary | `#f0d7c6` |
| secondary | `#f7e9dc` |
| accent | `#e0b79a` |

## Templates

### ROM-1 · Bouquet
*Wedding planner or florist.* Immersive cover, portrait-and-story, three cards, a masonry flow.

- **Home:** `Navigation` · `HeroPreset` · `AboutPortraitPreset` · `ServicesPreset` → secondary band · `GalleryMasonryPreset` · `CtaPreset` → accent band · `FooterSignaturePreset`
- **Gallery:** `Navigation` · `GalleryLandingPreset` · `GalleryMasonryJournalPreset` · `ContactPreset` → secondary band · `FooterSignaturePreset`
- **Rhythm:** soft bands only — secondary before accent, so the colour arrives gradually rather than in one hit.
- **Needs:** contact details, gallery images.

### ROM-2 · Love Letter
*Intimate elopement photographer.* Type-first, long biography, a small framed selection — the least commercial template in the set.

- **Home:** `Navigation` · `HeroStatementPreset` · `AboutPreset` · `GalleryGridFramedPreset` · `ServicesMenuPreset` → secondary band · `CtaImagePreset` · `FooterStatementPreset` → primary band
- **Gallery:** `Navigation` · `GalleryLandingMastheadPreset` · `GalleryMasonryPreset` · `FooterStatementPreset` → primary band
- **Rhythm:** almost bandless. The soft button style has to carry the entire colour signal above the footer, which is the point of the test.
- **Needs:** gallery images.

### ROM-3 · Garden Party
*Caterer or venue.* Collections lead, one featured package, a full studio profile.

- **Home:** `Navigation` · `HeroSplitPreset` · `FeaturedWorkLeadPreset` · `ServicesFeaturePreset` → primary band · `AboutProfilePreset` · `ContactSplitPreset` → secondary band · `FooterDirectoryPreset`
- **Gallery:** `Navigation` · `GalleryLandingSplitPreset` · `GalleryGridPreset` · `CtaMinimalPreset` → accent band · `FooterDirectoryPreset`
- **Rhythm:** primary mid-page, secondary near the close, accent reserved for the gallery's single ask.
- **Needs:** collections, contact details, gallery images.

---

# Modern

DM Serif Display + DM Sans · subtle radius · solid buttons. Structured and systematic; the serif display against a geometric sans is the whole idea, so let type carry the personality and keep colour architectural.

## Palettes

### M2-A · Concrete
Cool greys with one steel-blue accent. Architectural and near-monochrome; the serif headings supply all the warmth.

| slot | hex |
|---|---|
| background | `#f7f8f9` |
| foreground | `#16191c` |
| primary | `#dde2e6` |
| secondary | `#e8ebee` |
| accent | `#c3ccd4` |

### M2-B · Sea Glass
Aqua with a pale sand secondary. The most distinctive of the three and the strongest accent — the aqua is saturated enough to be an actual brand colour.

| slot | hex |
|---|---|
| background | `#f6f9f9` |
| foreground | `#12201f` |
| primary | `#cfe3e0` |
| secondary | `#eae5da` |
| accent | `#a9cfca` |

### M2-C · Studio Clay
Greige, soft terracotta, muted olive. Warmer than the current sage-and-lavender default and easier to live with across a long page.

| slot | hex |
|---|---|
| background | `#f9f8f5` |
| foreground | `#1c1b16` |
| primary | `#e3ded2` |
| secondary | `#eee6dd` |
| accent | `#cfc0a6` |

## Templates

### MOD-1 · Grid System
*Creative studio.* A compact project index and three equal cards — the most systematic layout in the set.

- **Home:** `Navigation` · `HeroSplitPreset` · `FeaturedWorkIndexPreset` → primary band · `ServicesPreset` · `AboutPreset` · `ContactBarPreset` → secondary band · `FooterDirectoryPreset`
- **Gallery:** `Navigation` · `GalleryLandingMastheadPreset` · `GalleryGridFullPreset` · `FooterDirectoryPreset`
- **Rhythm:** bands at the two structural joints only — after the intro, before the close.
- **Needs:** collections, contact details, gallery images.

### MOD-2 · Open Plan
*Venue.* Wide imagery and air. The full-width grid on Home does the work a separate gallery page usually does.

- **Home:** `Navigation` · `HeroPreset` · `AboutProfilePreset` · `GalleryGridFullPreset` · `ServicesFeaturePreset` → secondary band · `CtaImagePreset` · `FooterSignaturePreset`
- **Gallery:** `Navigation` · `GalleryLandingPreset` · `GalleryMasonryWallPreset` · `ContactBarPreset` → primary band · `FooterSignaturePreset`
- **Rhythm:** one band per zone. Everything else is photograph or ground.
- **Needs:** contact details, gallery images.

### MOD-3 · Case Study
*Commercial planner or production company.* Collections, then film, then a priced menu — a proof-first argument.

- **Home:** `Navigation` · `HeroStatementPreset` · `FeaturedWorkPreset` · `VideoSplitPreset` → secondary band · `ServicesMenuPreset` · `CtaMinimalPreset` → accent band · `FooterStatementPreset` → primary band
- **Gallery:** `Navigation` · `GalleryLandingSplitPreset` · `GalleryMasonryJournalPreset` · `CtaPreset` → accent band · `FooterStatementPreset` → primary band
- **Rhythm:** accent then primary, back to back at the close of both zones — a deliberate two-step ending.
- **Needs:** video, collections, gallery images.

---

---

# Modals

Every template also needs its two overlays: the **featured-work popup** (`defaultCollectionsPopup`, rendered by `CollectionPopupChrome` + `CollectionPopup`) and the **contact modal** (`defaultContact`, rendered by `ContactModal` + `ContactForm`).

Both live on the template record beside `seedData`, so recreating a template means setting these too. The visual comparison artifact has a **Modals** view that renders both over the dimmed page for whichever palette is selected.

## What is and is not configurable

**Featured-work popup** — shell ground / border / radius, the title (text, font, size, weight, italic, underline, colour, alignment) and the close button (size, radius, border width and colour, fill, opacity). The image grid itself is fixed: roughly six square tiles per row at an 8px gutter, opening a lightbox.

**Contact modal** — shell ground / text / radius / border, the heading and intro copy, the three tab labels' styling (`Client` / `Event` / `Location`), the submit button, the dashed "add session" button, and the error colour. The form fields are **not** configurable, and neither is the contact modal's own close button — it is a fixed 44px transparent control. Shell width is fixed too: 512px for the contact modal, 900px for the popup.

## Three defaults that had to be overridden everywhere

These are not stylistic preferences — all three were measured against the real resolvers and fail on the shipped defaults.

1. **The submit button.** `resolveSubmitAppearance` falls back to `color: var(--pf-color-primary)` with the label at `var(--pf-color-bg)`. On every light kit that is a pale tint under near-white text: **1.20:1** on `minimal`/Salt Flat, **1.30:1** on `luxury`/Obsidian & Brass. Setting `buttonColor` is necessary but not sufficient — the four templates shipping today all set it, and three of them still fail, measured against their own current brand kits:

   | template | label on fill | pairing |
   |---|---|---|
   | `bold` | **1.69:1** | unset (-> `background`) on `accent` |
   | `luxury` | **1.67:1** | `secondary` on `accent` |
   | `editorial` | **2.24:1** | `background` on `accent` |
   | `minimal` | 16.17:1 | unset (-> `background`) on `foreground` |

   A tinted `accent` fill cannot carry a `background` label. The configs below either fill with `foreground` (label falls to `background`, always high) or fill with a tint and set `buttonTextColor: "foreground"` plus a hairline, which is what makes the boundary legible.
2. **The shell border.** Both components fall back to a `foreground` hairline at 14% opacity. Against `ContactModal`'s `rgba(0,0,0,0.45)` backdrop that leaves the shell edge at **1.03:1** on the dark kits and 2.3–2.9:1 on several light ones. Every config below sets an explicit `borderWidth: 1` (or 2) with a real colour.
3. **The active tab.** A tonal chip cannot carry the active state on its own: every kit paints `background`, `primary`, `secondary` and `accent` inside the same lightness band, so a chip on a ground tops out around **1.1–1.4:1** — far short of the 3:1 needed for a state indicator. Every config that uses `activeTabHighlight` therefore also sets `activeTabUnderline`, which does clear it. `activeTabScale` is likewise paired with an underline rather than used alone.

Two smaller ones: `inactiveTabSubtle` defaults **on**, dropping inactive tab labels to 55% — **3.78:1** on a light kit, so every config sets it to `false`; and `CRM_ERROR_COLOR` (`#e7000b`) misses AA on the light grounds and on the dark ones (**4.09:1** on `luxury`), so light themes use `#9f0712` and Luxury uses `#ffa2a2`.

## Validation

All 18 pairs were checked against all three of their theme's palettes — 54 combinations — for popup and modal text, shell edge against the dimmed backdrop, submit label and boundary, add-session label and dashed border, error text, active-tab signal, and inactive-tab labels. **54/54 clean.** The same harness reports 4 failures for an empty config on `minimal` and 6 on `luxury`, which is the control.

## Minimal

### MIN-1 · White Cube

Ink hairline on the page ground; left-aligned Merriweather title. The plainest shell in the set.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `sharp` |
| `titleFontFamily` | `merriweather` |
| `titleFontSize` | `20` |
| `titleAlign` | `left` |
| `closeButtonSize` | `32` |
| `closeButtonRadius` | `sharp` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `background` |
| `closeButtonOpacity` | `100` |

**`defaultContact`**

Copy: title `"Enquire"`, description `"Tell us the date and where. We answer every message ourselves."`

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `textColor` | `foreground` |
| `popupRadius` | `sharp` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `foreground` |
| `buttonTextColor` | `background` |
| `buttonRadius` | `sharp` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `sharp` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#9f0712` |
| `tabFontSize` | `sm` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |

### MIN-2 · Contact Sheet

Tinted (`secondary`) ground with a background-token tab chip, so the modal reads as a working surface rather than a sheet of paper.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `secondary` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `sharp` |
| `titleFontFamily` | `merriweather` |
| `titleFontSize` | `18` |
| `titleBold` | `true` |
| `titleAlign` | `left` |
| `closeButtonSize` | `30` |
| `closeButtonRadius` | `sharp` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `background` |

**`defaultContact`**

Copy: title `"Book a sitting"`, description `"Three looks, one hour. Send a date and we will confirm within the day."`

| field | value |
|---|---|
| `backgroundColor` | `secondary` |
| `textColor` | `foreground` |
| `popupRadius` | `sharp` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `foreground` |
| `buttonTextColor` | `background` |
| `buttonRadius` | `sharp` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `sharp` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#9f0712` |
| `tabFontSize` | `sm` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabHighlight` | `true` |
| `tabHighlightColor` | `background` |
| `tabHighlightOpacity` | `100` |
| `activeTabRadius` | `sharp` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |

### MIN-3 · Quiet Room

Centred title at 26px and an `accent` submit fill held together by a foreground hairline — the one Minimal modal with colour in it.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `sharp` |
| `titleFontFamily` | `merriweather` |
| `titleFontSize` | `26` |
| `titleAlign` | `center` |
| `closeButtonSize` | `36` |
| `closeButtonRadius` | `sharp` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `background` |
| `closeButtonOpacity` | `80` |

**`defaultContact`**

Copy: title `"Start a conversation"`, description `"We take four weddings a year. Tell us about yours."`

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `textColor` | `foreground` |
| `popupRadius` | `sharp` |
| `popupBorderColor` | `accent` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `accent` |
| `buttonTextColor` | `foreground` |
| `buttonRadius` | `sharp` |
| `buttonBorderColor` | `foreground` |
| `buttonBorderWidth` | `1` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `sharp` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#9f0712` |
| `tabFontSize` | `md` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabScale` | `true` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |


## Editorial

### ED-1 · Masthead

A 2px rule around the contact modal: the masthead's own weight, carried into the overlay.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `sharp` |
| `titleFontFamily` | `playfair` |
| `titleFontSize` | `28` |
| `titleAlign` | `left` |
| `closeButtonSize` | `34` |
| `closeButtonRadius` | `sharp` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `background` |

**`defaultContact`**

Copy: title `"Enquiries"`, description `"Dates for next season are open. Send yours and we will hold it for a week."`

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `textColor` | `foreground` |
| `popupRadius` | `sharp` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `2` |
| `buttonColor` | `foreground` |
| `buttonTextColor` | `background` |
| `buttonRadius` | `sharp` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `sharp` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#9f0712` |
| `tabFontSize` | `md` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |

### ED-2 · Feature Story

`secondary` ground, borderless-looking close button, chip-highlighted tab. The softest Editorial shell.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `secondary` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `sharp` |
| `titleFontFamily` | `playfair` |
| `titleFontSize` | `24` |
| `titleAlign` | `left` |
| `closeButtonSize` | `32` |
| `closeButtonRadius` | `sharp` |
| `closeButtonBorderWidth` | `0` |
| `closeButtonBgColorToken` | `background` |
| `closeButtonOpacity` | `90` |

**`defaultContact`**

Copy: title `"Commission a film"`, description `"One crew, one edit. Tell us the date and the shape of the day."`

| field | value |
|---|---|
| `backgroundColor` | `secondary` |
| `textColor` | `foreground` |
| `popupRadius` | `sharp` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `foreground` |
| `buttonTextColor` | `background` |
| `buttonRadius` | `sharp` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `sharp` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#9f0712` |
| `tabFontSize` | `md` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabHighlight` | `true` |
| `tabHighlightColor` | `background` |
| `tabHighlightOpacity` | `100` |
| `activeTabRadius` | `sharp` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |

### ED-3 · Column Inch

16px bold Inter title instead of Playfair — a column head, not a headline. Compact inactive tabs.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `sharp` |
| `titleFontFamily` | `inter` |
| `titleFontSize` | `16` |
| `titleBold` | `true` |
| `titleAlign` | `left` |
| `closeButtonSize` | `28` |
| `closeButtonRadius` | `sharp` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `background` |

**`defaultContact`**

Copy: title `"Enquire"`, description `"Tell us the brief. We reply with a first outline, not a price list."`

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `textColor` | `foreground` |
| `popupRadius` | `sharp` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `accent` |
| `buttonTextColor` | `foreground` |
| `buttonRadius` | `sharp` |
| `buttonBorderColor` | `foreground` |
| `buttonBorderWidth` | `1` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `sharp` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#9f0712` |
| `tabFontSize` | `sm` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |
| `inactiveTabCompact` | `true` |


## Luxury

### LUX-1 · Private View

Ivory hairline, centred 30px Cormorant. The border is structural here, not decorative (see the note below).

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `sharp` |
| `titleFontFamily` | `cormorant` |
| `titleFontSize` | `30` |
| `titleAlign` | `center` |
| `closeButtonSize` | `36` |
| `closeButtonRadius` | `sharp` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `background` |
| `closeButtonOpacity` | `80` |

**`defaultContact`**

Copy: title `"By commission"`, description `"We accept a limited number of weddings each year. Tell us about yours."`

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `textColor` | `foreground` |
| `popupRadius` | `sharp` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `foreground` |
| `buttonTextColor` | `background` |
| `buttonRadius` | `sharp` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `sharp` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#ffa2a2` |
| `tabFontSize` | `md` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |

### LUX-2 · Atelier

Lifted `primary` ground so the shell separates from the near-black page even before the hairline does.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `primary` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `sharp` |
| `titleFontFamily` | `cormorant` |
| `titleFontSize` | `26` |
| `titleAlign` | `left` |
| `closeButtonSize` | `32` |
| `closeButtonRadius` | `sharp` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `primary` |
| `closeButtonOpacity` | `80` |

**`defaultContact`**

Copy: title `"Book a fitting"`, description `"Fittings run six weeks out. Send the date and we will find you a slot."`

| field | value |
|---|---|
| `backgroundColor` | `primary` |
| `textColor` | `foreground` |
| `popupRadius` | `sharp` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `foreground` |
| `buttonTextColor` | `background` |
| `buttonRadius` | `sharp` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `sharp` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#ffa2a2` |
| `tabFontSize` | `md` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabHighlight` | `true` |
| `tabHighlightColor` | `background` |
| `tabHighlightOpacity` | `100` |
| `activeTabRadius` | `sharp` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |

### LUX-3 · Cinema

16px bold Montserrat title and a 40px close button — the title behaves as a label, the control as a target.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `sharp` |
| `titleFontFamily` | `montserrat` |
| `titleFontSize` | `16` |
| `titleBold` | `true` |
| `titleAlign` | `left` |
| `closeButtonSize` | `40` |
| `closeButtonRadius` | `sharp` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `secondary` |

**`defaultContact`**

Copy: title `"Enquire"`, description `"We work in low light and small crews. Tell us where and when."`

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `textColor` | `foreground` |
| `popupRadius` | `sharp` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `foreground` |
| `buttonTextColor` | `background` |
| `buttonRadius` | `sharp` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `sharp` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#ffa2a2` |
| `tabFontSize` | `sm` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabScale` | `true` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |


## Bold

### BLD-1 · Poster

The accent ground, 2px foreground frame, 30px bold title. The loudest modal in the set, and the one that most changes between palettes.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `accent` |
| `borderColor` | `foreground` |
| `borderWidth` | `2` |
| `radius` | `sharp` |
| `titleFontFamily` | `montserrat` |
| `titleFontSize` | `30` |
| `titleBold` | `true` |
| `titleAlign` | `left` |
| `closeButtonSize` | `36` |
| `closeButtonRadius` | `sharp` |
| `closeButtonBorderWidth` | `2` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `accent` |

**`defaultContact`**

Copy: title `"Book the night"`, description `"Send the date, the room and the hours. We reply the same day."`

| field | value |
|---|---|
| `backgroundColor` | `accent` |
| `textColor` | `foreground` |
| `popupRadius` | `sharp` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `2` |
| `buttonColor` | `foreground` |
| `buttonTextColor` | `background` |
| `buttonRadius` | `sharp` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `sharp` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `2` |
| `errorMessageColor` | `#9f0712` |
| `tabFontSize` | `md` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |

### BLD-2 · Rate Card

`primary` submit fill with a foreground hairline, and a primary tab chip — the brand colour used as a button without losing the 3:1 boundary.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `sharp` |
| `titleFontFamily` | `montserrat` |
| `titleFontSize` | `22` |
| `titleBold` | `true` |
| `titleAlign` | `left` |
| `closeButtonSize` | `32` |
| `closeButtonRadius` | `sharp` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `background` |

**`defaultContact`**

Copy: title `"Request a rate card"`, description `"Tell us the deliverables and the usage. We quote in one message."`

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `textColor` | `foreground` |
| `popupRadius` | `sharp` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `primary` |
| `buttonTextColor` | `foreground` |
| `buttonRadius` | `sharp` |
| `buttonBorderColor` | `foreground` |
| `buttonBorderWidth` | `1` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `sharp` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#9f0712` |
| `tabFontSize` | `md` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabHighlight` | `true` |
| `tabHighlightColor` | `primary` |
| `tabHighlightOpacity` | `100` |
| `activeTabRadius` | `sharp` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |

### BLD-3 · Showreel

`primary` ground with a centred title; the submit reverses to a foreground fill so it still reads on the band.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `primary` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `sharp` |
| `titleFontFamily` | `montserrat` |
| `titleFontSize` | `26` |
| `titleBold` | `true` |
| `titleAlign` | `center` |
| `closeButtonSize` | `36` |
| `closeButtonRadius` | `sharp` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `background` |

**`defaultContact`**

Copy: title `"Brief us"`, description `"Stage, screens, sound, film. Tell us which of those you need."`

| field | value |
|---|---|
| `backgroundColor` | `primary` |
| `textColor` | `foreground` |
| `popupRadius` | `sharp` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `foreground` |
| `buttonTextColor` | `background` |
| `buttonRadius` | `sharp` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `sharp` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#9f0712` |
| `tabFontSize` | `md` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |


## Romantic

### ROM-1 · Bouquet

Rounded close button and a rounded active-tab chip against subtle-radius shells — the softest chrome in the set.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `subtle` |
| `titleFontFamily` | `cormorant` |
| `titleFontSize` | `28` |
| `titleAlign` | `center` |
| `closeButtonSize` | `34` |
| `closeButtonRadius` | `rounded` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `secondary` |
| `closeButtonOpacity` | `90` |

**`defaultContact`**

Copy: title `"Tell us about the day"`, description `"Flowers, planning, or both. Start anywhere."`

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `textColor` | `foreground` |
| `popupRadius` | `subtle` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `accent` |
| `buttonTextColor` | `foreground` |
| `buttonRadius` | `subtle` |
| `buttonBorderColor` | `foreground` |
| `buttonBorderWidth` | `1` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `subtle` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#9f0712` |
| `tabFontSize` | `md` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabHighlight` | `true` |
| `tabHighlightColor` | `secondary` |
| `tabHighlightOpacity` | `100` |
| `activeTabRadius` | `rounded` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |

### ROM-2 · Love Letter

Italic 30px Cormorant on a `secondary` ground. The only italic title.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `secondary` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `subtle` |
| `titleFontFamily` | `cormorant` |
| `titleFontSize` | `30` |
| `titleItalic` | `true` |
| `titleAlign` | `center` |
| `closeButtonSize` | `32` |
| `closeButtonRadius` | `rounded` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `background` |

**`defaultContact`**

Copy: title `"Write to me"`, description `"Two people and a registrar is a wedding. Tell me where."`

| field | value |
|---|---|
| `backgroundColor` | `secondary` |
| `textColor` | `foreground` |
| `popupRadius` | `subtle` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `foreground` |
| `buttonTextColor` | `background` |
| `buttonRadius` | `subtle` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `subtle` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#9f0712` |
| `tabFontSize` | `md` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |

### ROM-3 · Garden Party

A DM Sans label title on an accent-bordered shell — hospitality, not portfolio.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `borderColor` | `accent` |
| `borderWidth` | `1` |
| `radius` | `subtle` |
| `titleFontFamily` | `dm-sans` |
| `titleFontSize` | `18` |
| `titleBold` | `true` |
| `titleAlign` | `left` |
| `closeButtonSize` | `34` |
| `closeButtonRadius` | `subtle` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `background` |

**`defaultContact`**

Copy: title `"Check a date"`, description `"Ninety covers under glass. Tell us the date and the numbers."`

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `textColor` | `foreground` |
| `popupRadius` | `subtle` |
| `popupBorderColor` | `accent` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `foreground` |
| `buttonTextColor` | `background` |
| `buttonRadius` | `subtle` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `subtle` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#9f0712` |
| `tabFontSize` | `md` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabHighlight` | `true` |
| `tabHighlightColor` | `primary` |
| `tabHighlightOpacity` | `100` |
| `activeTabRadius` | `rounded` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |


## Modern

### MOD-1 · Grid System

DM Serif title, subtle radii throughout, secondary tab chip. The systematic baseline.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `subtle` |
| `titleFontFamily` | `dm-serif` |
| `titleFontSize` | `24` |
| `titleAlign` | `left` |
| `closeButtonSize` | `32` |
| `closeButtonRadius` | `subtle` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `background` |

**`defaultContact`**

Copy: title `"Start a project"`, description `"Identity, photography, or an event. Tell us which and when."`

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `textColor` | `foreground` |
| `popupRadius` | `subtle` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `foreground` |
| `buttonTextColor` | `background` |
| `buttonRadius` | `subtle` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `subtle` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#9f0712` |
| `tabFontSize` | `md` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabHighlight` | `true` |
| `tabHighlightColor` | `secondary` |
| `tabHighlightOpacity` | `100` |
| `activeTabRadius` | `subtle` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |

### MOD-2 · Open Plan

Rounded contact shell and a 40px rounded close button; `accent` submit with a hairline. The most open of the three.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `subtle` |
| `titleFontFamily` | `dm-serif` |
| `titleFontSize` | `30` |
| `titleAlign` | `left` |
| `closeButtonSize` | `40` |
| `closeButtonRadius` | `rounded` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `secondary` |
| `closeButtonOpacity` | `85` |

**`defaultContact`**

Copy: title `"Check availability"`, description `"Two floors, a courtyard and eighty seats. Send us a date."`

| field | value |
|---|---|
| `backgroundColor` | `background` |
| `textColor` | `foreground` |
| `popupRadius` | `rounded` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `accent` |
| `buttonTextColor` | `foreground` |
| `buttonRadius` | `rounded` |
| `buttonBorderColor` | `foreground` |
| `buttonBorderWidth` | `1` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `rounded` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#9f0712` |
| `tabFontSize` | `md` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabScale` | `true` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |

### MOD-3 · Case Study

16px DM Sans label title, compact inactive tabs, `secondary` ground. Reads as a form, deliberately.

**`defaultCollectionsPopup`**

| field | value |
|---|---|
| `backgroundColor` | `secondary` |
| `borderColor` | `foreground` |
| `borderWidth` | `1` |
| `radius` | `subtle` |
| `titleFontFamily` | `dm-sans` |
| `titleFontSize` | `16` |
| `titleBold` | `true` |
| `titleAlign` | `left` |
| `closeButtonSize` | `30` |
| `closeButtonRadius` | `sharp` |
| `closeButtonBorderWidth` | `1` |
| `closeButtonBorderColorToken` | `foreground` |
| `closeButtonBgColorToken` | `background` |

**`defaultContact`**

Copy: title `"Request a proposal"`, description `"Give us the dates, the headcount and the cities."`

| field | value |
|---|---|
| `backgroundColor` | `secondary` |
| `textColor` | `foreground` |
| `popupRadius` | `subtle` |
| `popupBorderColor` | `foreground` |
| `popupBorderWidth` | `1` |
| `buttonColor` | `foreground` |
| `buttonTextColor` | `background` |
| `buttonRadius` | `subtle` |
| `addSessionButtonColor` | `foreground` |
| `addSessionButtonRadius` | `subtle` |
| `addSessionButtonBorderColor` | `foreground` |
| `addSessionButtonBorderWidth` | `1` |
| `errorMessageColor` | `#9f0712` |
| `tabFontSize` | `sm` |
| `tabColor` | `foreground` |
| `activeTabColor` | `foreground` |
| `activeTabUnderline` | `true` |
| `tabUnderlineColor` | `foreground` |
| `inactiveTabSubtle` | `false` |
| `inactiveTabCompact` | `true` |

---

---

# Gallery renditions

Mockups for two surfaces that are currently too thin: the **featured-work popup** and the **view-image modal**. Four layouts each, shown in the artifact's **Renditions** view under any theme and palette.

These are an **owner-facing choice**, not a per-template constant — any template can use any layout. The per-template assignments at the end of this section are recommended starting points, not constraints.

## Where the current implementation stops

The view-image modal today is `Lightbox.tsx`: an `rgba(0,0,0,0.85)` backdrop, the image at `max 95vw/95vh`, and one round close button. Its entire data contract is:

```ts
export type LightboxImage = { id: string; publicId: string; alt: string };
```

There is no title, no description, no navigation — to see the next photograph you close the modal and open another one. The featured-work popup is a fixed 900px shell over a square grid at roughly six per row.

**Most of the missing metadata is already in the database.** `GalleryItem` stores `caption`, `altText`, `tags`, `width`, `height`, `format`, `sizeBytes` and `createdAt`. It is `normalizeItem` in `CollectionPopup.tsx` that throws it away:

```ts
return { id: item.id, publicId: item.publicId, alt: item.alt ?? item.caption ?? "" };
```

Widening that boundary is the first change, and it is a small one.

## Image metadata model

| field | status | shown as |
|---|---|---|
| `title` | **new** | The heading of the modal |
| `caption` | exists | The description paragraph |
| `altText` | exists | Alt attribute only — never displayed |
| `date` | **new** | Shoot fact |
| `location` | **new** | Shoot fact |
| `client` | **new** | Shoot fact |
| `meta: [{ label, value }]` | **new** | Free-form rows — Film stock, Lens, Styling, whatever the owner wants |
| `tags` | exists | Pills |
| `width` / `height` / `format` / `sizeBytes` | exists | Technical line, e.g. `4000 × 6000 · JPEG · 8.2 MB` |

Five new scalar fields plus one array. Every field is optional, and each rendition degrades to whatever is present — an image with only a `caption` still renders correctly in all four.

The free-form `meta` array is the one that needs real editor work: a repeater in the image block with add / remove / reorder. The other five are plain text inputs.

## Featured-work popup renditions

New field: `popupLayout` on `PortfolioCollectionsPopupConfig`, defaulting to `contact-sheet` so every existing page renders exactly as it does now.

### 1. Contact sheet — `contact-sheet`
Uniform squares, six to a row, with a real index header. The closest to what ships today, and the safe migration.

- Fixed 900px shell
- Square crops, 6 per row
- Header carries the collection name, photograph count and description
- Hover reveals the image title over a foreground scrim
- Opens the image modal

### 2. Justified rows — `justified`
Rows scaled to a common height so every photograph keeps its own aspect ratio. Edge-to-edge, no crop. What a gallery looks like when the work mixes landscape and portrait.

- Wider 1080px shell
- Native aspect ratios, nothing cropped
- Rows share a height, not a column width — so a row's height falls out of the aspect ratios in it, and the packer needs a target height with a tolerance, not a fixed row count
- 4px gutters, flush edges
- Opens the image modal

### 3. Split index — `split-index`
A column that stays put carrying the collection's name, description and facts, while the photographs scroll beside it. For collections that have something to say before they are looked at.

- Sticky 300px narrative column on the theme's `secondary` ground
- Two-up masonry beside it
- Collection description plus a facts list
- Stacks under the text on mobile
- Opens the image modal

### 4. Immersive — `immersive`
The popup takes the whole viewport: one photograph at a time with a filmstrip beneath it. Collection browsing and image viewing become one surface.

- Full-viewport shell
- One image with a filmstrip rail, current frame outlined
- Metadata in a corner panel over the image
- Arrow keys move between images
- **No separate image modal** — picking this makes `imageModalLayout` inert

## View-image modal renditions

New field: `imageModalLayout`, defaulting to `caption`.

### 1. Captioned — `caption`
The current lightbox, finished: still one photograph on a dark scrim, but with a caption line, a position counter and arrows. The smallest change that closes the navigation gap.

- Dark scrim, unchanged from today
- Title and description centred beneath the image
- Prev / next controls and an `n / total` counter
- Arrow keys to move, Esc to close

### 2. Detail panel — `sidebar`
A panel beside the photograph holding everything the image knows. The archive reading, for work that is catalogued rather than browsed.

- Image left, 340px panel right
- Every metadata group visible at once: description, shoot facts, custom rows, tags, technical
- Panel painted in the brand ground, not on the scrim
- Panel drops below the image on mobile
- Prev / next in the panel header

### 3. Cinema — `cinema`
Full-bleed on near-black with a translucent bar that can be dismissed, and a filmstrip along the bottom. Built for looking at a run of photographs rather than at one.

- Full-bleed image on a near-black ground
- Collapsible metadata bar over a bottom gradient
- Filmstrip rail with the current frame marked
- Arrow keys and swipe
- Chrome fades after a pause

### 4. Catalogue sheet — `sheet`
The photograph inside a page in the site's own colours rather than floating on black. For studios whose portfolio is a document.

- Brand `background` ground inside a dark scrim — the sheet is brand-coloured, the scrim still darkens the page
- Title as a real heading in the theme's display face
- Metadata as a three-column definition list
- Respects the theme's radius and fonts
- Prev / next beneath the sheet

## Two contrast rules these introduce

1. **Scrim text is not the palette foreground.** `caption` and `cinema` sit on a black scrim regardless of theme. Using `--pf-color-fg` there would make text invisible on all four light themes, since their foregrounds are near-black. Both use a fixed near-white (`#f2f2f2`, muted at 66%) instead. This is the first place in the portfolio system where a surface deliberately ignores the brand kit, and it should be commented as such.
2. **The catalogue sheet's scrim must not derive from a token.** An early pass built it from `foreground` at 55%, which inverts on the dark kits — a *light* wash around a dark sheet. The scrim is a flat `rgba(0,0,0,0.55)` in every theme; only the sheet itself is brand-coloured.

`sidebar` and `sheet` paint their text on brand tokens, so they inherit the existing 4.5:1 foreground guarantee and need no special handling.

## Recommended starting assignment

| template | featured work | view image |
|---|---|---|
| MIN-1 White Cube | `justified` | `sheet` |
| MIN-2 Contact Sheet | `contact-sheet` | `caption` |
| MIN-3 Quiet Room | `split-index` | `sidebar` |
| ED-1 Masthead | `split-index` | `sheet` |
| ED-2 Feature Story | `justified` | `cinema` |
| ED-3 Column Inch | `contact-sheet` | `sidebar` |
| LUX-1 Private View | `immersive` | — (subsumed) |
| LUX-2 Atelier | `split-index` | `sidebar` |
| LUX-3 Cinema | `justified` | `cinema` |
| BLD-1 Poster | `contact-sheet` | `caption` |
| BLD-2 Rate Card | `justified` | `sidebar` |
| BLD-3 Showreel | `immersive` | — (subsumed) |
| ROM-1 Bouquet | `justified` | `caption` |
| ROM-2 Love Letter | `split-index` | `sheet` |
| ROM-3 Garden Party | `contact-sheet` | `sidebar` |
| MOD-1 Grid System | `contact-sheet` | `caption` |
| MOD-2 Open Plan | `immersive` | — (subsumed) |
| MOD-3 Case Study | `split-index` | `sidebar` |

Every layout is used at least twice, so whichever templates win, the whole menu gets exercised.

## What this costs to build

Roughly in dependency order, and none of it is blocked by the template work:

1. **Widen `normalizeItem`** and the popup's API response to carry the fields that already exist (`caption`, `tags`, dimensions). This alone makes `caption` and `sidebar` mostly buildable.
2. **Add the five new `GalleryItem` fields plus the `meta` array**, and the image-block inputs for them. The repeater is the only non-trivial piece.
3. **Add `popupLayout` and `imageModalLayout`** to the config types, validators and the editor's panels, both defaulting to today's behaviour.
4. **Add a `description` to `GalleryCollection`** — layouts 1–3 all show one and the model has no field for it.
5. **Build the layouts.** `contact-sheet` is the existing code; `justified` needs a row packer; `immersive` is the largest single piece because it replaces two surfaces with one.
6. **Navigation.** Prev / next, a counter, arrow keys and focus management belong in the shared `Lightbox`, not per layout — every rendition but `immersive` reuses it.

---

## Coverage

All 33 non-navigation presets appear at least once across the 18 templates, so whichever winners are chosen the library gets exercised rather than the same six blocks reused.

## Recording a winner

**Palette:** replace the five hex values in `THEME_PRESET_DEFINITIONS[<theme>].brandKit`. `themePreset`, fonts, `radius` and `buttonStyle` stay as they are. `presetContrast.test.ts` and `themePresetDefinitions.test.ts` are the gate — both must stay green.

**Template:** recreate it in the builder, save it as a named draft, and hand the draft to the agent rewriting `lib/page-builder/templates/*`. New template ids also need adding to `PORTFOLIO_TEMPLATE_IDS` in `lib/page-builder/templates/types.ts`, which the `Workspace.publicPage.templateId` enum imports.

**Modals:** the two config objects go on the same template record as `defaultCollectionsPopup` and `defaultContact`, beside `seedData`. They are plain data, so they can be transcribed from the tables above without going through the builder — but if a palette winner differs from the one a modal was designed against, re-run the contrast check before committing it.
