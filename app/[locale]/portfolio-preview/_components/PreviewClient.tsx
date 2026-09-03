"use client";

import { useEffect, useMemo, useState } from "react";
import { Render, type Data } from "@measured/puck";
import { puckConfig } from "@/lib/page-builder/config";
import type { PuckData } from "@/lib/page-builder/types";
import type { RenderWorkspace } from "@/lib/page-builder/serverContext";
import { normalizePageBody } from "@/lib/page-builder/pageBody";

const LOCAL_DRAFT_VERSION = 2;

type DraftShape = {
  version?: number;
  draftId?: string | null;
  data?: Partial<Record<"home" | "gallery", PuckData>>;
};

function readDraftZone(
  slug: string,
  zone: "home" | "gallery",
  draftId: string | null,
): PuckData | null {
  try {
    const raw = window.localStorage.getItem(`gallurio:portfolio-draft:${slug}`);
    if (!raw) return null;
    const draft = JSON.parse(raw) as DraftShape;
    // The buffer is one-per-slug and can lag behind which draft the server
    // resolved (e.g. edited draft A, closed tab, reopened onto draft B) —
    // only apply it when its recorded draftId matches the requested one;
    // missing/null on either side means "the unsaved/new draft" and is a match.
    if ((draft.draftId ?? null) !== (draftId ?? null)) return null;
    const zoneData = draft.version === LOCAL_DRAFT_VERSION ? draft.data?.[zone] : undefined;
    return zoneData && Array.isArray(zoneData.content)
      ? (normalizePageBody(zoneData as unknown as Data) as unknown as PuckData)
      : null;
  } catch {
    return null;
  }
}

export function PreviewClient({
  slug,
  zone,
  workspace,
  fallbackData,
  draftId,
}: {
  slug: string;
  zone: "home" | "gallery";
  workspace: RenderWorkspace;
  fallbackData: PuckData;
  draftId: string | null;
}) {
  const normalizedFallback = useMemo(
    () => normalizePageBody(fallbackData as unknown as Data) as unknown as PuckData,
    [fallbackData],
  );
  // PreviewBrandShell does not mount its children until localStorage has been
  // read, so this lazy state is the first visible render rather than an update
  // from the published server fallback.
  const [data, setData] = useState<PuckData>(
    () => readDraftZone(slug, zone, draftId) ?? normalizedFallback,
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs the localStorage draft (external store) when the preview zone changes
    setData(readDraftZone(slug, zone, draftId) ?? normalizedFallback);
  }, [normalizedFallback, slug, zone, draftId]);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Render data={data as any} config={puckConfig as any} metadata={{ workspace }} />
  );
}
