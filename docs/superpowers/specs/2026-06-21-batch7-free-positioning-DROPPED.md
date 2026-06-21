# Batch 7 — Absolute / Free Positioning (#13): DROPPED

- **Date:** 2026-06-21
- **Decision:** Do not implement. Cut from the portfolio-enhancements scope.

## Rationale
- **Off-brand for the audience.** Gallurio's users are event businesses, not designers. Modern opinionated builders they'd compare against (Squarespace, Carrd, Wix Studio's responsive mode) deliberately avoid free/absolute positioning because it guarantees good mobile output with no user effort. The tools that have it are pro/designer tools (Webflow, Framer) or the cautionary tale (classic Wix's absolute canvas → infamously broken mobile).
- **Fights the framework.** Puck is flow/zone-based; absolute positioning would be a large, fragile custom build (drag layer, coordinate storage, hit-testing) bolted onto a tool that doesn't model it.
- **Two layout models forever.** "Desktop-free, mobile-stack" means storing free coordinates plus a stack mapping and reconciling them on every edit — a perennial bug source and a tax on every future block.
- **Mobile-first bar.** It's the feature most likely to let a non-designer ship something broken at 375px, directly against the project's mobile-first requirement.
- **~80% already covered.** Multi-column arrangement, spanning, alignment, and spacing are handled by the shipped Container/Columns + span/rows work (#21/#22) plus alignment/spacer controls.

## If revisited later
Prefer bounded column/grid enhancements (more presets, finer span/alignment controls) over absolute positioning.
