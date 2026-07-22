import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import {
  DEFAULT_BRAND_KIT,
  DEFAULT_HEADER_CONFIG,
  type PuckData,
} from "@/lib/page-builder/types";
import { PORTFOLIO_TEMPLATES } from "@/lib/page-builder/templates";
import { DemoDisclaimerBanner } from "@/components/app/demo-disclaimer-banner";
import { EditorShell, type EditorTemplateSummary } from "../(app)/portfolio/_components/EditorShell";

// A demo canvas is never indexed — mirrors app/[locale]/portfolio-preview/page.tsx.
export const metadata: Metadata = { robots: { index: false, follow: false } };

const EMPTY_ZONE: PuckData = { content: [], root: {} };

function toPlain<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return fallback;
  }
}

/**
 * Public, unauthenticated Portfolio Maker demo. Lives directly under `[locale]`
 * (not `(app)` or `(marketing)`) so it inherits providers + brand fonts but
 * neither the app sidebar nor the marketing header/footer — same nesting
 * rationale as portfolio-preview/page.tsx, minus the auth gate.
 *
 * No workspace exists for an anonymous visitor: EditorShell's `demoMode`
 * persists entirely to localStorage (keyed by a per-browser demo session id —
 * see lib/page-builder/demoSession.ts), so every "initial*" prop below is a
 * static empty/default seed, not a DB read.
 */
export default async function PortfolioMakerDemoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Serializable starter-template summaries for the in-editor switcher —
  // identical mapping to app/[locale]/(app)/portfolio/page.tsx.
  const templates: EditorTemplateSummary[] = PORTFOLIO_TEMPLATES.map((tpl) => ({
    id: tpl.id,
    label: tpl.label,
    description: tpl.description,
    defaultBrandKit: toPlain(tpl.defaultBrandKit, DEFAULT_BRAND_KIT),
  }));
  const publicOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

  // Full-bleed editor, same wrapper pattern as the real editor page, except
  // the banner is a flex sibling ABOVE EditorShell (not just visually stacked)
  // so the pair is clipped to exactly `h-svh` instead of the banner's height
  // pushing the total past the viewport — that overflow used to leak into a
  // page-level vertical scroll (nothing here declared overflow-y), hiding the
  // nav tabs/banner above the fold and breaking scroll inside the guide/canvas.
  // EditorShell fills the remaining flex space (`demoMode` swaps its own root
  // to `h-full` instead of `min-h-svh` so it doesn't re-introduce the same
  // overflow one level down).
  return (
    <div className="-m-6 flex h-svh flex-col overflow-hidden">
      <DemoDisclaimerBanner />
      <div className="min-h-0 flex-1 overflow-hidden">
        <EditorShell
          demoMode
          slug=""
          workspaceName="Your Studio"
          initialData={{ home: EMPTY_ZONE, gallery: EMPTY_ZONE }}
          initialBrandKit={DEFAULT_BRAND_KIT}
          initialContact={{}}
          initialFormLocale=""
          initialFormDir=""
          initialHeaderConfig={DEFAULT_HEADER_CONFIG}
          initialCollectionsPopup={{}}
          publicOrigin={publicOrigin}
          // The demo never previews/publishes against a real public page — no
          // anonymous-visitor route exists to preview against. Both actions are
          // already demoMode-gated behind the upsell modal in EditorShell
          // (handlePublish/doPublish); previewBasePath itself is only consumed
          // to build an iframe src if the visitor toggles Preview, which is a
          // known, deferred UX gap (see report), not a crash.
          previewBasePath=""
          templates={templates}
          currentTemplateId="scratch"
          // Always false: an anonymous demo page load has no server-persisted
          // dismissal to read (demoMode's guide-dismissed state, if any, lives
          // only in this component's own client state for the current mount).
          guideDismissed={false}
          initialSavedThemes={[]}
          // Unused in demoMode — EditorShell's storyPromptOpen initializer is
          // unconditionally false when demoMode is true (its own 2-option entry
          // screen fully replaces StoryPromptDialog), so this value never reads.
          storyPromptCompleted={true}
          initialSeoDescription=""
          initialSeoKeywords={[]}
          initialInquiryRecipientEmail=""
          hasBeenPublished={false}
          workspaceBusinessType=""
          initialDrafts={[]}
          initialActiveDraftId={null}
          initialActiveDraftName=""
        />
      </div>
    </div>
  );
}
