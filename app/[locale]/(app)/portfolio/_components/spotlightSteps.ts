import type { SpotlightStep } from "./SpotlightGuide";

/**
 * 14-stop spotlight tour steps for the portfolio editor.
 * Editor chrome is English-only (RELEASE-CHECKLIST §4f).
 *
 * Gate ids used by EditorShell to compute `gateSatisfied`:
 *   "drag-block"   — a block was dropped (content count increased)
 *   "select-block" — a block is selected (selectedItem non-null)
 *   "open-header"  — header panel is open (headerOpen === true)
 *   "open-contact" — contact panel is open (contactOpen === true)
 *   (style-tab steps are PASSIVE — no gate; tab changes happen inside the panel)
 */
export const SPOTLIGHT_STEPS: SpotlightStep[] = [
  // 0 — Welcome (centred, no anchor)
  {
    id: "welcome",
    title: "Welcome to your portfolio editor",
    body: "Here's a quick, hands-on tour to get you up to speed. You can skip anytime.",
  },

  // 1 — Blocks panel
  {
    id: "blocks-panel-toggle",
    anchorId: "blocks-panel",
    title: "Open the blocks panel",
    body: "Click this to open the panel of blocks you can drag onto your page.",
    placement: "bottom",
    gated: true,
  },

  // 2 — Drag a block
  {
    id: "drag-block",
    anchorId: "canvas",
    title: "Drag a block onto your page",
    body: "Try it: drag any block from the left panel and drop it onto the canvas here.",
    placement: "right",
    gated: true,
  },

  // 3 — Select a block
  {
    id: "select-block",
    anchorId: "canvas",
    title: "Click a block to select it",
    body: "Now click the block you just added. Selecting a block reveals its properties.",
    placement: "right",
    gated: true,
  },

  // 4 — Properties panel
  {
    id: "properties-panel",
    anchorId: "properties-panel",
    title: "Block properties appear here",
    body: "When a block is selected, its settings show up in this panel on the right.",
    placement: "left",
  },

  // 4.1 — Content tab (passive — tab changes happen inside the panel)
  {
    id: "style-tab-content",
    anchorId: "style-tab-content",
    title: "Content: the block's text and media",
    body: "The Content tab is where you edit the block's actual text, images, and links.",
    placement: "bottom",
  },

  // 4.2 — Design tab (passive)
  {
    id: "style-tab-design",
    anchorId: "style-tab-design",
    title: "Design: colors, borders, and corners",
    body: "The Design tab controls typography, background color, borders, shadows, and animations.",
    placement: "bottom",
  },

  // 4.3 — Layout tab (passive)
  {
    id: "style-tab-layout",
    anchorId: "style-tab-layout",
    title: "Layout: size, spacing, and position",
    body: "The Layout tab controls gap, min-height, alignment, and grid placement.",
    placement: "bottom",
  },

  // 5 — Section tabs
  {
    id: "section-tabs",
    anchorId: "section-tabs",
    title: "Switch between pages",
    body: "Use these tabs to switch between your Home page and your Gallery page.",
    placement: "bottom",
  },

  // 6 — Header tab (gated: open header panel)
  {
    id: "header-tab",
    anchorId: "header-tab",
    title: "Customize your header",
    body: "Try it: click Header to open the header settings — logo, navigation links, and styling.",
    placement: "bottom",
    gated: true,
  },

  // 6.1 — Logo uploader
  {
    id: "logo-uploader",
    anchorId: "logo-uploader",
    title: "Upload your logo",
    body: "Upload a PNG, JPEG, or WEBP logo. It will appear in the header on your live page.",
    placement: "right",
  },

  // 6.2 — Header nav/style
  {
    id: "header-nav-style",
    anchorId: "header-nav-style",
    title: "Navigation links and header style",
    body: "The Design tab lets you set colors, borders, and typography for your header and nav links.",
    placement: "right",
  },

  // 7 — Contact tab (gated: open contact panel)
  {
    id: "contact-tab",
    anchorId: "contact-tab",
    title: "Your inquiry form",
    body: "Try it: click Contact to open the contact settings. Visitors use this form to reach you.",
    placement: "bottom",
    gated: true,
  },

  // 7.1 — Contact form preview
  {
    id: "contact-form-preview",
    anchorId: "contact-form-preview",
    title: "Choose fields and styling",
    body: "Select which fields to show and how they look. The form layout itself is fixed.",
    placement: "right",
  },

  // 8 — Photos
  {
    id: "photos",
    anchorId: "photos",
    title: "Upload and organize photos",
    body: "Open Photos to create collections and upload images. Gallery blocks pull from a collection.",
    placement: "bottom",
  },

  // 9 — Theme
  {
    id: "theme",
    anchorId: "theme",
    title: "Pick your colors and fonts",
    body: "Theme controls your five brand colors and typography. Every block's style options use this palette.",
    placement: "bottom",
  },

  // 10 — Preview + device toggle
  {
    id: "preview-device",
    anchorId: "preview-toggle",
    title: "Preview your site at any screen size",
    body: "Switch to preview mode and use the device toggle to check your layout on mobile, tablet, and desktop.",
    placement: "bottom",
  },

  // 10.1 — Publish
  {
    id: "publish",
    anchorId: "publish",
    title: "Publish to go live",
    body: "When you're happy with your changes, click Publish to push them to your public page.",
    placement: "bottom",
  },

  // 11 — Save + Drafts
  {
    id: "save-drafts",
    anchorId: "save-changes",
    title: "Save drafts and switch versions",
    body: "Save changes at any time. Use Drafts to manage multiple versions. Reopen this tour via the Guide button.",
    placement: "bottom",
  },
];
