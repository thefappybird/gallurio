"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { EditorShellProps } from "./EditorShell";

// `/portfolio`'s server page.tsx statically imported EditorShell, shipping
// all of Puck before hydration. Dynamic-import it client-only instead — same
// pattern as components/ui/location-picker.tsx's LocationMap.
const EditorShell = dynamic(() => import("./EditorShell").then((m) => m.EditorShell), {
  ssr: false,
  loading: () => <EditorShellSkeleton />,
});

function EditorShellSkeleton() {
  const t = useTranslations("app.pageBuilder.editor");
  return (
    <div
      className="h-full w-full animate-pulse bg-muted"
      aria-busy="true"
      aria-label={t("loadingDraft")}
    />
  );
}

export function EditorShellLoader(props: EditorShellProps) {
  return <EditorShell {...props} />;
}
