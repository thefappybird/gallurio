---
name: portfolio-editor-architecture
description: Orientation map for Gallurio's portfolio builder (the in-app editor at /portfolio and the public pages at /w/[orgSlug]). Use this BEFORE touching anything in the portfolio editor — EditorShell, Puck blocks, the spotlight guide/tour, theme/brand-kit, drafts, the public renderer, or the contact form. It explains how the pieces fit and routes you to the focused sub-skill for your task, so you don't rediscover the architecture from scratch. Trigger whenever the work involves the portfolio editor, portfolio blocks, the editor's guided tour, portfolio theming, portfolio drafts, or the public portfolio pages.
---

# Portfolio builder architecture (orientation)

Gallurio's portfolio builder is a Puck-powered visual editor. This skill is the map;
load the focused sub-skill for your actual task.

## The shape
- **Source of truth:** `Workspace.publicPage` (Mongo). One document holds the whole
  portfolio. Do NOT create separate portfolio collections unless explicitly needed.
- **Three public pages only:** Home, Gallery, Contact — served at `app/(public)/w/[orgSlug]/...`.
- **Shared Puck config powers BOTH the editor and the public renderer** (`lib/page-builder/`).
  A block's `render()` is the same in-editor and on the live page — so an editor change
  is a public-page change. Treat that as a hard invariant.
- **The editor heart is `EditorShell`**
  (`app/[locale]/(app)/portfolio/_components/EditorShell.tsx`): hosts Puck, the left
  blocks panel, the right properties panel (`StyleToolkitField`), the top tab strip
  (`navCluster`: Home / Gallery / Collections Popup / Navigation / Contact Form / Preview),
  drafts, theme, photos, publish/save.
- **Zones & sub-panels:** `EDITOR_SECTIONS = ["home","gallery","collectionsPopup","header","contact"]`.
  Home/Gallery are Puck zones; header/contact/collectionsPopup are side panels opened via
  `openHeader()` / `openContact()` / `openCollectionsPopup()`.
- **Chrome is English-only** (RELEASE-CHECKLIST §4f). Public copy uses the 4 locales
  (`en`, `fil`, `ms`, `id`); the editor UI does not.

## Route to the right sub-skill
- **Guided tour / spotlight / "Guide" button / steps / cutout / why a step won't advance**
  → `portfolio-guide`. (Sandbox dual-shell, `guideQueryRoot` scoping, gated=visual-only
  cutout, `useElementRect`. This is gotcha-dense — read it before debugging the tour.)
- **Adding/editing a block, block fields, padding/gap/color/font controls, Columns grid,
  col/row span, defaultProps** → `portfolio-blocks-and-design`.
- **Driving the editor in a browser / Playwright / dnd-kit drag / reaching a gated step /
  asserting the canvas** → `portfolio-testing`.
- **Brand colors, fonts, `--pf-*` tokens, the Theme panel** → `portfolio-theme-brand-kit`.
- **Drafts, versions, local autosave, publish/discard** → `portfolio-drafts`.

## Cross-cutting rules
- Multi-tenant: every read/write scopes by `workspaceId`; never trust client `workspaceId`.
- Public portfolios may override brand styling ONLY inside the public page wrapper.
- The contact form is fixed; inquiry submit creates `Inquiry` + `Client` + inquiry `Booking`
  in one transaction.
- Reuse before rebuild — check `REUSABLE_CODE.md`.
