"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Puck } from "@puckeditor/core";
import { PanelTabs } from "@/components/ui/panel-tabs";
import { usePuckStore } from "@/lib/page-builder/puckHooks";

type SideBarTab = "components" | "outline";

/**
 * Open PageBody the first time the outline is shown.
 *
 * Every block the owner actually edits sits inside the locked PageBody
 * wrapper, so a collapsed outline opens on nothing but the pinned nav and
 * footer. Fires once per mount: re-expanding on every visit would undo an
 * owner who deliberately collapsed it.
 */
function useExpandPageBodyOnce(showingOutline: boolean): void {
  const dispatch = usePuckStore((s) => s.dispatch);
  // Must return a primitive: usePuckStore reads through useSyncExternalStore,
  // which compares snapshots with Object.is, so a fresh object per call is an
  // infinite re-render (see EditorContainerAnchor for the same constraint).
  const pageBodyId = usePuckStore((s) => {
    const content = s.appState.data.content as
      | Array<{ type: string; props?: { id?: string } }>
      | undefined;
    return content?.find((item) => item.type === "PageBody")?.props?.id ?? null;
  });

  const expanded = useRef(false);
  useEffect(() => {
    if (!showingOutline || expanded.current || !pageBodyId) return;
    expanded.current = true;
    dispatch({
      type: "setUi",
      ui: (prev: { itemExpanded?: Record<string, boolean> }) => ({
        itemExpanded: { ...prev.itemExpanded, [pageBodyId]: true },
      }),
    });
  }, [showingOutline, pageBodyId, dispatch]);
}

/**
 * The editor's left sidebar.
 *
 * Puck 0.21 replaced the single sidebar with an icon rail (Blocks / Outline as
 * separate rail tabs). `legacySideBarPlugin` undoes that by stacking both
 * sections in one scrolling column, but it spends a section header on our own
 * block tree — which already carries its own headings — leaving a dead band
 * above "Preset blocks".
 *
 * This puts that band to work: the two panels become tabs in the editor's own
 * tab styling, sharing the control the block inspector's Content/Design/Layout
 * header uses. `Puck.Components` still routes through the `drawer` override, so
 * the block tree is unchanged.
 *
 * Translates itself rather than taking labels as props: Puck renders its panels
 * through `createPortal` and never mounts a second React root, so next-intl
 * context reaches here. That also keeps the `plugins` array module-level, whose
 * identity Puck must see unchanged between renders.
 */
export function EditorSideBar() {
  const t = useTranslations("app.pageBuilder.editor");
  const [tab, setTab] = useState<SideBarTab>("components");
  useExpandPageBodyOnce(tab === "outline");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelTabs
        tabs={[
          { id: "components" as const, label: t("puckConfig.sidebar.components") },
          { id: "outline" as const, label: t("puckConfig.sidebar.outline") },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tab === "components" ? <Puck.Components /> : <Puck.Outline />}
      </div>
    </div>
  );
}
