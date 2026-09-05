"use client";

// Read-only cross-zone chrome info threaded from EditorShell down to the
// detach-toggle control living inside StyleToolkitField.tsx, without prop-
// drilling through every intermediate panel (mirrors demoPickerContext.ts's
// pattern). The toggle itself is a normal Puck field bound to the chrome
// block's own `detached` prop — flipping it round-trips through Puck's
// onChange back to EditorShell's `handleChange`, which runs the actual
// sync/reanchor/confirm-dialog logic. This context only answers "is this
// zone allowed to detach right now, and if not, who holds it" so the control
// can disable itself and show the right hint copy
// (`app.pageBuilder.editor.chromeDetachDisabledHint`).
//
// Provided once by EditorShell, wrapping the whole Puck tree; null outside it
// (e.g. in isolated block-render tests).
//
// StyleToolkitField.tsx already defines the exact shape its toggle control
// wants (`NavDetachContext`: `{ zoneLabel, otherZoneLabel, disabled }`) and
// threads it as a prop down to `NavigationConfigPanel`, but nothing calls
// `useChromeSync()` yet to build that value at the top (`StyleToolkitField`'s
// own export, or wherever `<StyleToolkitField navDetach={...} />` is
// rendered in editorConfig.tsx's `styleField.render`). Build it from this
// context with:
//   const other = zone === "home" ? "gallery" : "home";
//   { zoneLabel: t(`zone.${zone}`), otherZoneLabel: t(`zone.${other}`),
//     disabled: !ctx.canDetach(zone, "nav") }

import { createContext, useContext } from "react";
import type { ChromeKind, ZoneKey } from "./chromeSync";

export type ChromeSyncCtx = {
  /** True when `zone` may turn `detached` ON for this chrome `kind` right now
   *  (the other zone doesn't already hold it). Always true when `zone` is
   *  already the one detached (toggling back off doesn't need permission). */
  canDetach: (zone: ZoneKey, kind: ChromeKind) => boolean;
  /** The zone currently holding `detached: true` for this kind, or null when
   *  neither zone is detached. Feeds the disabled-toggle hint copy. */
  detachedZone: (kind: ChromeKind) => ZoneKey | null;
} | null;

export const ChromeSyncContext = createContext<ChromeSyncCtx>(null);

export function useChromeSync(): ChromeSyncCtx {
  return useContext(ChromeSyncContext);
}
