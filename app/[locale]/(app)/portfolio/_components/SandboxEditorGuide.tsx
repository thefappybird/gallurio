"use client";

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
 */
export function SandboxEditorGuide({ templates, onFinished, onSkipped }: Props) {
  return (
    <div
      className="fixed inset-0 z-[9980] bg-background"
      aria-label="Portfolio editor guide"
      role="region"
    >
      <EditorShell
        guideMode
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
        initialSavedThemes={[]}
        initialDrafts={[]}
        initialActiveDraftId={null}
        initialActiveDraftName={undefined}
      />
    </div>
  );
}
