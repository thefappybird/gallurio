"use client";

import { useCallback, useState } from "react";
import { EditorShell, type EditorTemplateSummary } from "./EditorShell";
import {
  DEFAULT_BRAND_KIT,
  DEFAULT_HEADER_CONFIG,
  type PortfolioBrandKit,
  type PortfolioCollectionsPopupConfig,
  type PortfolioContactConfig,
  type PortfolioHeaderConfig,
  type PuckData,
} from "@/lib/page-builder/types";

// Scratch data: empty zones so the gated "drag-block" step teaches the
// interaction from scratch, and no real workspace content is ever loaded.
const EMPTY_ZONE: PuckData = { content: [], root: {} };

const SANDBOX_BRAND_KIT: PortfolioBrandKit = DEFAULT_BRAND_KIT;
const SANDBOX_HEADER: PortfolioHeaderConfig = DEFAULT_HEADER_CONFIG;
const SANDBOX_CONTACT: PortfolioContactConfig = {};
const SANDBOX_COLLECTIONS_POPUP: PortfolioCollectionsPopupConfig = {};

type Props = {
  templates: EditorTemplateSummary[];
  /** Called when the sandbox guide closes for any reason (finish or skip). */
  onFinished: (dontShowAgain: boolean) => void;
  /** Called when the user explicitly skips the guide mid-tour. */
  onSkipped: (dontShowAgain: boolean) => void;
};

/**
 * Full-screen overlay that mounts a second EditorShell in guideMode so the
 * interactive spotlight tour runs against scratch data — the real editor's
 * drafts, localStorage, and server state are never touched.
 *
 * The container element is tracked via a ref-callback that stores it in React
 * state so it can be passed to EditorShell as `guideQueryRoot` without
 * accessing a ref during render (which violates react-hooks/refs). Once the
 * container mounts, the state update causes a re-render that passes the real
 * element to EditorShell's spotlight guide, scoping all anchor queries to this
 * overlay's subtree.
 *
 * Without scoping, `document.querySelector('[data-tour-id="..."]')` would find
 * the outer editor shell's element first (it renders earlier in DOM order),
 * causing the cutout to misplace and gated steps to never satisfy.
 */
export function SandboxEditorGuide({ templates, onFinished, onSkipped }: Props) {
  // Store the container element in state (not a ref) so we can safely pass it
  // to EditorShell during render without triggering react-hooks/refs.
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    setContainerEl(el);
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9980] bg-background"
      aria-label="Portfolio editor guide"
      role="region"
    >
      <EditorShell
        guideMode
        guideQueryRoot={containerEl}
        onGuideFinish={onFinished}
        onGuideSkipClose={onSkipped}
        slug="__sandbox__"
        workspaceName="My Portfolio"
        initialData={{ home: EMPTY_ZONE, gallery: EMPTY_ZONE }}
        initialBrandKit={SANDBOX_BRAND_KIT}
        initialContact={SANDBOX_CONTACT}
        initialHeaderConfig={SANDBOX_HEADER}
        initialCollectionsPopup={SANDBOX_COLLECTIONS_POPUP}
        initialFormLocale=""
        publicOrigin=""
        previewBasePath="/en/portfolio/preview"
        templates={templates}
        currentTemplateId=""
        guideDismissed={false}
        storyPromptCompleted={true}
        initialSeoDescription=""
        initialSeoKeywords={[]}
        workspaceBusinessType=""
        initialSavedThemes={[]}
        initialDrafts={[]}
        initialActiveDraftId={null}
        initialActiveDraftName={undefined}
      />
    </div>
  );
}
