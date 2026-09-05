/**
 * Navigation section presets — one neutral insertable header plus three legacy
 * looks retained only so already-saved draft/page data keeps rendering. The
 * legacy looks were seeded from the
 * looks previously baked into the `bold`/`editorial`/`luxury` templates'
 * `defaultHeader` values (before those moved onto this block). `minimal` and
 * `scratch` used the generic `DEFAULT_HEADER_CONFIG` look, so they contribute
 * no distinct variant here.
 *
 * Unlike every other preset group these are NOT `ContainerBlockProps` — each
 * renders through `NavigationBlock` (`componentType: "Navigation"` in the
 * registry entry). `_chrome: "nav"` marks them for chromeSync's home/gallery
 * mirroring (wired by a later EditorShell wave).
 */

import type { NavigationBlockProps } from "../NavigationBlock";
import { DEFAULT_HEADER_CONFIG } from "../../types";
import { child, slot } from "./_helpers";

const NAV_CONTENT = slot([child("Heading", { level: "h3", text: "Studio Name" })]);

/** The sole insertable navigation preset. Owners build its logo from the uploader. */
export const NAVIGATION_PRESET: NavigationBlockProps = {
  ...DEFAULT_HEADER_CONFIG,
  _chrome: "nav",
  content: NAV_CONTENT,
};

/** Bordered navbar — from the `bold` template's former defaultHeader. */
export const NAV_BORDERED_PRESET: NavigationBlockProps = {
  _chrome: "nav",
  highlightOpacity: 40,
  contactButtonOpacity: 100,
  borderBottomWidth: 2,
  borderBottomColor: "foreground",
  navbarSize: "sleek",
  activeLinkScale: false,
  activeLinkHighlight: true,
  activeLinkRadius: "subtle",
  activeLinkUnderline: false,
  contactButtonColor: "accent",
  contactButtonTextColor: "background",
  contactButtonRadius: "subtle",
  content: NAV_CONTENT,
};

/** Underlined navbar — from the `editorial` template's former defaultHeader. */
export const NAV_UNDERLINED_PRESET: NavigationBlockProps = {
  _chrome: "nav",
  highlightOpacity: 100,
  contactButtonOpacity: 100,
  fontSize: "sm",
  navbarSize: "sleek",
  activeLinkHighlight: false,
  activeLinkUnderline: true,
  underlineColor: "accent",
  contactButtonColor: "accent",
  contactButtonRadius: "subtle",
  content: NAV_CONTENT,
};

/** Scaled navbar — from the `luxury` template's former defaultHeader. */
export const NAV_SCALED_PRESET: NavigationBlockProps = {
  _chrome: "nav",
  highlightOpacity: 100,
  contactButtonOpacity: 100,
  fontSize: "sm",
  activeLinkScale: true,
  activeLinkHighlight: false,
  contactButtonColor: "accent",
  contactButtonTextColor: "secondary",
  contactButtonRadius: "",
  content: NAV_CONTENT,
};
