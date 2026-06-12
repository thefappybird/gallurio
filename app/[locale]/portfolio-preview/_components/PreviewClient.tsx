"use client";

import { useEffect, useState } from "react";
import { Render } from "@measured/puck";
import { puckConfig } from "@/lib/page-builder/config";
import type { PuckData } from "@/lib/page-builder/types";
import type { RenderWorkspace } from "@/lib/page-builder/serverContext";

const LOCAL_DRAFT_VERSION = 1;

type DraftShape = {
  version?: number;
  data?: Partial<Record<"home" | "gallery", PuckData>>;
};

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
  const [data, setData] = useState<PuckData>(fallbackData);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`gallurio:portfolio-draft:${slug}`);
      if (!raw) return;
      const draft = JSON.parse(raw) as DraftShape;
      if (draft.version !== LOCAL_DRAFT_VERSION) return;
      const zoneData = draft.data?.[zone];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs the localStorage draft (external store) into React state on mount; server fallbackData is already the initial state
      if (zoneData && Array.isArray(zoneData.content)) setData(zoneData);
    } catch {
      // ignore malformed draft; keep server fallback
    }
  }, [slug, zone]);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Render data={data as any} config={puckConfig as any} metadata={{ workspace }} />
  );
}
