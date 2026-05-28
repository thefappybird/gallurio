# Phase 1 — Puck config + shared block contract

> Parent: `../master-plan.md`
> Branch: `feat/page-builder-config-and-blocks-contract` cut from `dev` **after Phase 0 lands**
> No public-facing UI — pure scaffolding for Phases 2–4.

---

## Context

`@measured/puck` is installed in `package.json` but `lib/page-builder/` does not exist. Both the public renderer (Phase 2) and every block (Phases 3–4) need to import the same `Config<Components>` so the editor and the public site never drift. Phase 1 lays that scaffolding plus the shared **brand-kit context** every block will read.

A block must:
1. Render on the server by default (no `"use client"` unless it owns interactive state).
2. Read brand kit values (colors, radius, font pair) from a context — never hardcode.
3. Reference structured data (gallery items, collections) by ID, not by inlined URLs.
4. Be typed end-to-end so Puck's editor panels generate from the type.

---

## Acceptance criteria

- `lib/page-builder/config.ts` exports a typed `puckConfig` with the block component union and a per-block field schema. Initially the registry is empty `{}` — Phase 3 fills it.
- `lib/page-builder/brandKitContext.tsx` exports `BrandKitProvider` (client) and `useBrandKit` (client) **and** `resolveBrandKit(brandKit)` (server helper that returns a `{ cssVars, classNames }` tuple for use by server renderers).
- `lib/page-builder/types.ts` exports `PortfolioBrandKit`, `PortfolioPuckData`, `PortfolioBlockProps<TName>`, plus the `BrandKitThemePreset` / `BrandKitFontPair` / `BrandKitRadius` / `BrandKitButtonStyle` enums.
- `lib/page-builder/index.ts` is a small barrel re-exporting `puckConfig`, brand-kit utilities, and types. (One barrel is acceptable here — per `CLAUDE.md` it's the existing exception path mirroring `lib/db/models/index.ts`.)
- `lib/validators/publicPage.ts` exports `brandKitSchema` (Zod) and `portfolioPuckDataSchema`. The Workspace model imports both for validation later in Phase 8.
- Unit tests:
  - `brandKitContext.test.tsx` — provider injects values, hook reads them, CSS vars match the inputs.
  - `resolveBrandKit.test.ts` — produces correct CSS variable map for each theme preset and radius option.
  - `publicPage.test.ts` (validator) — rejects invalid enum values and out-of-range colors.
- `pnpm typecheck` and `pnpm test --run page-builder` both pass.

---

## Critical files to create

```
lib/page-builder/
  config.ts                # puckConfig + Components type union
  types.ts                 # PortfolioBrandKit, PortfolioPuckData, PortfolioBlockProps<T>
  brandKitContext.tsx      # BrandKitProvider, useBrandKit, resolveBrandKit
  index.ts                 # barrel
  brandKitContext.test.tsx
  resolveBrandKit.test.ts
lib/validators/
  publicPage.ts            # brandKitSchema, portfolioPuckDataSchema
  publicPage.test.ts
```

---

## Design notes

### `PortfolioBrandKit` (canonical shape)

```ts
export const BRAND_KIT_THEME_PRESETS = [
  "minimal", "editorial", "luxury", "bold", "romantic", "modern",
] as const;
export type BrandKitThemePreset = (typeof BRAND_KIT_THEME_PRESETS)[number];

export const BRAND_KIT_FONT_PAIRS = [
  "merriweather-only",
  "playfair-inter",
  "dm-serif-dm-sans",
  "cormorant-montserrat",
  "fraunces-inter",
] as const;
export type BrandKitFontPair = (typeof BRAND_KIT_FONT_PAIRS)[number];

export const BRAND_KIT_RADII = ["sharp", "subtle", "rounded"] as const;
export const BRAND_KIT_BUTTON_STYLES = ["solid", "outline", "soft"] as const;

export type PortfolioBrandKit = {
  themePreset: BrandKitThemePreset;
  fontPair: BrandKitFontPair;
  primaryColor: string;        // #RRGGBB
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  radius: (typeof BRAND_KIT_RADII)[number];
  buttonStyle: (typeof BRAND_KIT_BUTTON_STYLES)[number];
};

export const DEFAULT_BRAND_KIT: PortfolioBrandKit = {
  themePreset: "minimal",
  fontPair: "merriweather-only",
  primaryColor: "#111111",
  secondaryColor: "#f5f5f5",
  accentColor: "#2f5d56",   // gallurio brand teal
  backgroundColor: "#ffffff",
  foregroundColor: "#111111",
  radius: "sharp",
  buttonStyle: "solid",
};
```

### `resolveBrandKit(brandKit)` output

```ts
{
  cssVars: {
    "--pf-color-primary": "#111111",
    "--pf-color-secondary": "#f5f5f5",
    "--pf-color-accent": "#2f5d56",
    "--pf-color-bg": "#ffffff",
    "--pf-color-fg": "#111111",
    "--pf-radius": "0",
    "--pf-font-heading": "'Playfair Display', serif",
    "--pf-font-body": "'Inter', sans-serif",
  },
  className: "pf-theme-minimal pf-button-solid",
}
```

Server renderer applies these to the public page's outer `<div>` so they cascade only to the public-page subtree (per CLAUDE.md scoping rule).

### `puckConfig` skeleton

```ts
import type { Config } from "@measured/puck";
import type { PortfolioBlockProps } from "./types";

type Components = {
  // Filled in Phase 3 — Hero, About, GalleryGrid, ServicesList, CTABanner, ContactCard
};

export const puckConfig: Config<Components> = {
  components: {},   // populated as blocks are added
  root: {
    fields: {},
  },
};
```

The empty registry is intentional. Phase 2 just needs the export to exist; Phase 3 fills it.

### `portfolioPuckDataSchema`

Two named zones, since the Workspace stores `data: { home, gallery }`:

```ts
const puckDataSchema = z.object({
  root: z.object({ props: z.record(z.unknown()).optional() }).optional(),
  content: z.array(z.object({ type: z.string(), props: z.record(z.unknown()) })),
  zones: z.record(z.array(z.object({ type: z.string(), props: z.record(z.unknown()) }))).optional(),
});

export const portfolioPuckDataSchema = z.object({
  home: puckDataSchema.nullable(),
  gallery: puckDataSchema.nullable(),
});
```

Loose on `props` — Puck's per-block validation happens at the editor layer via Zod adapters in Phase 3.

---

## Verification

```bash
pnpm typecheck
pnpm test --run page-builder
pnpm test --run validators/publicPage
```

Manually: import `puckConfig` and `useBrandKit` from a scratch file in `app/(public)/_scratch/` to confirm both server and client imports resolve. Delete the scratch file before commit.

---

## Out of scope

- Any block implementations (Phase 3).
- Persistence (Workspace schema changes happen in Phase 2 alongside the renderer).
- Editor UI (Phase 9).
- Wizard flow (Phase 8).

---

## Branch & merge

```
git checkout dev   # post-Phase-0 dev
git checkout -b feat/page-builder-config-and-blocks-contract
# … work + tests …
git commit -m "feat(page-builder): scaffold puck config, brand kit context, and validators"
git push -u origin feat/page-builder-config-and-blocks-contract
# PR review, then merge into dev
```
