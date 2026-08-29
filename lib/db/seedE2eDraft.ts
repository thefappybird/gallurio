/**
 * The e2e fixture draft.
 *
 * Several editor specs need a canvas holding specific structure, not a pretty
 * page: `item3-columns-grid`, `batch2-span-verify` and `batch2-block-panel`
 * drive the Columns grid controls, the grid-child span controls, and the block
 * properties panel. They used to load a draft called "new draft 2", which no
 * longer exists — the seed drifted and the specs failed at the drafts dialog.
 *
 * A starter template is the wrong fixture for this: templates are design
 * artifacts and are free to change shape, which silently turns these specs
 * vacuous. This draft is owned by the tests instead, so the contract below is
 * explicit and a change that breaks it is a deliberate act.
 *
 * CONTRACT — do not remove any of these without updating the specs that read
 * them (each line names its consumer):
 *
 *  1. A `Columns` block with EXACTLY 2 columns.       item3-columns-grid
 *     The spec asserts the grid does NOT start at 3 before clicking "3", so a
 *     3-column fixture makes the assertion pass without testing anything.
 *  2. `Container` blocks as DIRECT children of that   batch2-span-verify
 *     grid, so `.pf-cols > [data-block="container"]` matches and the Column
 *     span control renders (it only appears for real grid children).
 *  3. A heading at h1/h2/h3 in the canvas.            batch2-block-panel
 *  4. A Hero preset, whose outline label is           batch2-block-panel
 *     "Immersive cover" — the preset library moved labels from the flat group
 *     name to the variant name, so "Hero" no longer selects anything.
 */

import type { PuckBlockEntry, PuckData } from "@/lib/page-builder/types";
import { zone, heading, columns, heroPreset } from "@/lib/page-builder/templates/_blocks";

/** The draft name the specs load. Changing it breaks them — update both sides. */
export const E2E_FIXTURE_DRAFT_NAME = "E2E Block Fixture";

/**
 * A Container holding a heading and a paragraph, used as a grid child.
 *
 * The `id` is REQUIRED and must be unique, even though `_blocks.ts` notes that
 * nested slot children generally do not need one. A Container is itself a
 * drop-zone: `resolveContainerData` injects a `ContainerAnchor` child derived
 * from the Container's own id. Two id-less Containers both derive
 * `undefined--anchor`, colliding in the Puck tree — observed as the editor
 * refetching the draft in a tight loop until the toolbar never mounts.
 */
function gridCard(id: string, title: string, body: string): PuckBlockEntry {
  return {
    type: "Container",
    props: {
      id,
      backgroundImages: [],
      minHeight: "auto",
      _style: { gap: 8, bgColorToken: "background" },
      content: [
        { type: "Heading", props: { level: "h3", text: title } },
        { type: "Text", props: { text: body } },
      ],
    },
  } as unknown as PuckBlockEntry;
}

export function buildE2eFixtureData(): { home: PuckData; gallery: PuckData } {
  return {
    home: zone([
      // Contract 4.
      heroPreset("e2e-hero"),
      // Contract 3 — an unambiguous top-level heading for the panel spec.
      heading("e2e-heading", { text: "Studio services", level: "h2" }),
      // Contracts 1 and 2.
      columns("e2e-columns", {
        columns: 2,
        content: [
          gridCard("e2e-card-weddings", "Weddings", "Full-day coverage across Metro Manila."),
          gridCard("e2e-card-portraits", "Portraits", "Studio and on-location sessions."),
        ],
      }),
    ]),
    gallery: zone([]),
  };
}
