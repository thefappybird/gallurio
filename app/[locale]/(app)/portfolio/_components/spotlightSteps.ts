import type { SpotlightStep } from "./SpotlightGuide";

/**
 * Spotlight tour steps for the portfolio editor.
 * Editor chrome is intentionally English-only.
 *
 * Gate ids used by EditorShell to compute `gateSatisfied` (actionable steps —
 * Next is hidden until the action is performed):
 *   "drag-block"   — a block was dropped (content count increased)
 *   "header-tab"   — Navigation panel is open (headerOpen === true)
 *   "contact-tab"  — contact panel is open (contactOpen === true)
 * All other steps are passive (advance with Next).
 *
 * Panels (blocks list, properties) are open by default, so there is no
 * "open the panel" step. Dropping a block auto-selects it and reveals its
 * properties, so there is no separate "select a block" step.
 *
 * Steps with `passthrough: true` render the dim for visual context but make
 * all overlay layers pointer-events:none so the user can drag freely across
 * the full viewport (needed for drag-block: grab from panel, drop on canvas).
 */
export const SPOTLIGHT_STEPS: SpotlightStep[] = [
  // Welcome (centred, no anchor)
  {
    id: "welcome",
    slug: "welcome",
    title: "Welcome to your portfolio editor",
    body: "Here's a quick, hands-on tour to get you up to speed. You can skip anytime.",
  },

  // Blocks panel — gated: user must drag a block to the canvas to advance.
  // passthrough lets pointer events reach the real editor so the drag works.
  // secondaryAnchorId highlights the canvas as the drop target alongside the panel.
  // "canvas-viewport" (not "canvas") — the latter is Puck's `puck` override slot,
  // which wraps the ENTIRE editor UI (header/drawer/editor/fields), not just the
  // canvas. "canvas-viewport" is Puck's `preview` slot, scoped to the grid's
  // actual editor column.
  {
    id: "drag-block",
    slug: "dragBlock",
    anchorId: "blocks-panel",
    secondaryAnchorId: "canvas-viewport",
    title: "Drag a block onto your page",
    body: "Choose a Preset block from the panel on the left, then drag it onto the canvas. Presets include the editing controls used in the next steps.",
    placement: "right",
    gated: true,
    passthrough: true,
  },

  // Properties panel — anchor targets the full right sidebar column
  // (marked by RightPanelTourMarker inside the fields override in EditorShell).
  {
    id: "properties-panel",
    slug: "blockProps",
    anchorId: "properties-panel-full",
    title: "Block properties live here",
    body: "Dropping a block selects it automatically — its settings appear in this panel on the right.",
    placement: "left",
  },

  // Content tab (passive — tab changes happen inside the panel)
  {
    id: "style-tab-content",
    slug: "contentTab",
    anchorId: "style-tab-content",
    title: "Content: the block's text and media",
    body: "The Content tab is where you edit the block's actual text, images, and links.",
    placement: "bottom",
  },

  // Design tab (passive)
  {
    id: "style-tab-design",
    slug: "designTab",
    anchorId: "style-tab-design",
    title: "Design: colors, borders, and corners",
    body: "The Design tab controls typography, background color, borders, shadows, and animations.",
    placement: "bottom",
  },

  // Layout tab (passive)
  {
    id: "style-tab-layout",
    slug: "layoutTab",
    anchorId: "style-tab-layout",
    title: "Layout: size, spacing, and position",
    body: "The Layout tab controls gap, min-height, alignment, and grid placement.",
    placement: "bottom",
  },

  // Section tabs — spans all five page tabs (Home → Contact Form), non-gated.
  {
    id: "section-tabs",
    slug: "switchPages",
    anchorId: "section-tabs",
    title: "Switch between pages",
    body: "Switch between the different parts of your portfolio website.",
    placement: "bottom",
  },

  // Navigation tab (actionable: open the Navigation panel)
  {
    id: "header-tab",
    slug: "openNav",
    anchorId: "header-tab",
    title: "Open Navigation",
    body: "Click Navigation to set up your site's header — brand, logo, menu links, and styling.",
    placement: "bottom",
    gated: true,
  },

  // Navigation · Setup tab
  {
    id: "header-setup-tab",
    slug: "navSetup",
    anchorId: "header-setup-tab",
    title: "Navigation · Setup",
    body: "The Setup tab is where you set your brand text, navbar size, logo, and menu links.",
    placement: "bottom",
  },

  // Logo uploader (passive detail)
  {
    id: "logo-uploader",
    slug: "logo",
    anchorId: "logo-uploader",
    title: "Your logo lives here",
    body: "This is your logo uploader — a PNG, JPEG, or WEBP added here shows in the header on your live page.",
    placement: "left",
  },

  // Navigation · Design tab
  {
    id: "header-design-tab",
    slug: "navDesign",
    anchorId: "header-design-tab",
    title: "Navigation · Design",
    body: "The Design tab controls header colors, borders, and typography for your nav links.",
    placement: "bottom",
  },

  // Contact tab (actionable: open the contact panel)
  {
    id: "contact-tab",
    slug: "contactForm",
    anchorId: "contact-tab",
    title: "Your inquiry form",
    body: "Click Contact Form to set up the form visitors use to reach you.",
    placement: "bottom",
    gated: true,
  },

  // Contact · Setup tab
  {
    id: "contact-setup-tab",
    slug: "contactSetup",
    anchorId: "contact-setup-tab",
    title: "Contact · Setup",
    body: "The Setup tab sets the form's language, title, and description. The form's fields and layout are fixed.",
    placement: "bottom",
  },

  // Contact · Design tab
  {
    id: "contact-design-tab",
    slug: "contactDesign",
    anchorId: "contact-design-tab",
    title: "Contact · Design",
    body: "The Design tab restyles the form — text and background colors to match your brand. You can't hide fields, only change how they look.",
    placement: "bottom",
  },

  // Preview + device toggle
  {
    id: "preview-device",
    slug: "preview",
    anchorId: "preview-toggle",
    title: "Preview your site at any screen size",
    body: "Switch to preview mode and use the device toggle to check your layout on mobile, tablet, and desktop.",
    placement: "bottom",
  },

  // The wrapper remains in the sandbox editor at every supported width. The
  // compact popover itself is portaled, so the guide deliberately targets this
  // stable trigger/group rather than content outside guideQueryRoot.
  {
    id: "canvas-controls",
    slug: "canvasControls",
    anchorId: "canvas-controls",
    title: "Adjust your editing canvas",
    body: "Use these controls to toggle panels, undo or redo, choose a canvas width, and zoom. On smaller screens, open the sliders button to find them.",
    placement: "bottom",
  },

  // Language + RTL control — page-wide translation of the public chrome.
  // Always present in the edit header (beside the viewport controls), so it
  // needs no gating or panel restore.
  {
    id: "translate",
    slug: "translate",
    anchorId: "language-control",
    title: "Translate your public pages",
    body: "Use the language control here to switch your navigation, contact form, and collection popups all at once. On smaller screens, open the sliders button first.",
    placement: "bottom",
  },

  // Photos
  {
    id: "photos",
    slug: "photos",
    anchorId: "photos",
    title: "Upload and organize photos",
    body: "Open Photos to create collections and upload images. Gallery blocks pull from a collection.",
    placement: "bottom",
  },

  // Theme
  {
    id: "theme",
    slug: "theme",
    anchorId: "theme",
    title: "Pick your colors and fonts",
    body: "Theme controls your five brand colors and typography. Every block's style options use this palette.",
    placement: "bottom",
  },

  // Guide
  {
    id: "guide",
    slug: "guide",
    anchorId: "guide",
    title: "Return to this guide anytime",
    body: "Open Guide whenever you want to replay this walkthrough.",
    placement: "bottom",
  },

  // Drafts
  {
    id: "drafts",
    slug: "draftsStep",
    anchorId: "drafts",
    title: "Save drafts and switch versions",
    body: "Open Drafts to create and manage independent versions of your portfolio.",
    placement: "bottom",
  },

  // Save
  {
    id: "save",
    slug: "save",
    anchorId: "save-changes",
    title: "Save your changes",
    body: "Save changes to keep the current draft ready to return to later.",
    placement: "bottom",
  },

  // Publish
  {
    id: "publish",
    slug: "publish",
    anchorId: "publish",
    title: "Publish to go live",
    body: "When you're happy with your changes, click Publish to push them to your public page.",
    placement: "bottom",
  },
];

/** Which side panel must be open for a given tour step id. */
export type GuidePanel = "nav" | "contact" | "none";

const NAV_STEPS = new Set(["header-setup-tab", "logo-uploader", "header-design-tab"]);
const CONTACT_STEPS = new Set(["contact-setup-tab", "contact-design-tab"]);

/**
 * Returns which side panel must be open when the tour is on the step with
 * `stepId`. Used by EditorShell to restore panel context on every step change
 * so anchors exist (and Back works across panels).
 */
export function guideStepPanel(stepId: string | undefined): GuidePanel {
  if (!stepId) return "none";
  if (NAV_STEPS.has(stepId)) return "nav";
  if (CONTACT_STEPS.has(stepId)) return "contact";
  return "none";
}

/** Computed open/close flags for EditorShell panel state on each guide step. */
export type GuidePanelActions = {
  openHeader: boolean;
  openContact: boolean;
  closeHeader: boolean;
  closeContact: boolean;
};

/**
 * Given the current step id and the current open/close state of both side
 * panels, returns which panels need to be opened or closed so the step's
 * anchor is present. openHeader/openContact each close the other internally,
 * so only the relevant open flag is set; closeHeader/closeContact are only
 * set for the "none" bucket when a panel is actually open.
 */
export function guidePanelActions(
  stepId: string | undefined,
  state: { headerOpen: boolean; contactOpen: boolean }
): GuidePanelActions {
  const panel = guideStepPanel(stepId);
  if (panel === "nav") {
    return { openHeader: !state.headerOpen, openContact: false, closeHeader: false, closeContact: false };
  }
  if (panel === "contact") {
    return { openHeader: false, openContact: !state.contactOpen, closeHeader: false, closeContact: false };
  }
  return { openHeader: false, openContact: false, closeHeader: state.headerOpen, closeContact: state.contactOpen };
}

/**
 * Returns true when navigating to `nextStepId` requires resetting the guide
 * canvas to empty. The drag-block step must start with a blank canvas so its
 * drop-gate re-arms correctly on Back; reset is only needed when there is
 * already content on the canvas (`hasContent`).
 */
export function shouldResetGuideCanvasOnStep(nextStepId: string, hasContent: boolean): boolean {
  return nextStepId === "drag-block" && hasContent;
}

/**
 * Dispatches the computed panel actions to concrete callbacks. All branching
 * is isolated here so the EditorShell call site is a single non-branching
 * expression.
 */
export function applyGuidePanelActions(
  actions: GuidePanelActions,
  cb: {
    openHeader: () => void;
    openContact: () => void;
    closeHeader: () => void;
    closeContact: () => void;
  },
): void {
  if (actions.openHeader) cb.openHeader();
  if (actions.openContact) cb.openContact();
  if (actions.closeHeader) cb.closeHeader();
  if (actions.closeContact) cb.closeContact();
}
