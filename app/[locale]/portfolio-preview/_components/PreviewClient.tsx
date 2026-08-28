"use client";

import { useEffect, useState } from "react";
import { Render } from "@measured/puck";
import { puckConfig } from "@/lib/page-builder/config";
import type { PuckData } from "@/lib/page-builder/types";
import type { RenderWorkspace } from "@/lib/page-builder/serverContext";

const LOCAL_DRAFT_VERSION = 2;

type DraftShape = {
  version?: number;
  data?: Partial<Record<"home" | "gallery", PuckData>>;
};

function readDraftZone(slug: string, zone: "home" | "gallery"): PuckData | null {
  try {
    const raw = window.localStorage.getItem(`gallurio:portfolio-draft:${slug}`);
    if (!raw) return null;
    const draft = JSON.parse(raw) as DraftShape;
    const zoneData = draft.version === LOCAL_DRAFT_VERSION ? draft.data?.[zone] : undefined;
    return zoneData && Array.isArray(zoneData.content) ? zoneData : null;
  } catch {
    return null;
  }
}

export function PreviewClient({
  slug,
  zone,
  workspace,
  fallbackData,
}: {
  slug: string;
  zone: "home" | "gallery";
  workspace: RenderWorkspace;
  fallbackData: PuckData;
}) {
  // PreviewBrandShell does not mount its children until localStorage has been
  // read, so this lazy state is the first visible render rather than an update
  // from the published server fallback.
  const [data, setData] = useState<PuckData>(() => readDraftZone(slug, zone) ?? fallbackData);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs the localStorage draft (external store) when the preview zone changes
    setData(readDraftZone(slug, zone) ?? fallbackData);
  }, [fallbackData, slug, zone]);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Render data={data as any} config={puckConfig as any} metadata={{ workspace }} />
  );
}
