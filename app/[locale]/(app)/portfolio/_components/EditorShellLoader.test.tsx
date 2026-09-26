import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Stub the dynamically-imported EditorShell — the real one pulls in Puck +
// several Server Actions that don't belong in this unit test. Mirrors
// components/ui/location-picker.test.tsx's next/dynamic mock.
vi.mock("next/dynamic", () => ({
  default: () =>
    function MockEditorShell(props: Record<string, unknown>) {
      return <div data-testid="editor-shell" data-props={JSON.stringify(props)} />;
    },
}));

import { EditorShellLoader } from "./EditorShellLoader";
import type { EditorShellProps } from "./EditorShell";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

const baseProps: EditorShellProps = {
  slug: "studio-aurora",
  workspaceId: "ws-studio-aurora",
  workspaceName: "Studio Aurora",
  initialData: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
  initialBrandKit: DEFAULT_BRAND_KIT,
  initialContact: {},
  initialHeaderConfig: {},
  initialCollectionsPopup: {},
  initialFormLocale: "",
  publicOrigin: "https://app.test",
  previewBasePath: "/portfolio-preview",
  templates: [],
  currentTemplateId: "scratch",
  guideDismissed: true,
  storyPromptCompleted: true,
  initialSeoDescription: "",
  initialSeoKeywords: [],
  initialInquiryRecipientEmail: "",
  hasBeenPublished: false,
  workspaceBusinessType: "",
  initialSavedThemes: [],
};

describe("EditorShellLoader", () => {
  it("renders the dynamically-imported EditorShell with the given props", () => {
    render(<EditorShellLoader {...baseProps} />);

    const shell = screen.getByTestId("editor-shell");
    const props = JSON.parse(shell.getAttribute("data-props") ?? "{}");
    expect(props).toMatchObject({
      slug: "studio-aurora",
      workspaceId: "ws-studio-aurora",
      workspaceName: "Studio Aurora",
    });
  });
});
