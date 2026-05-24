/**
 * Tests for DangerPanel.
 *
 * Key behaviours tested:
 *  - delete confirm button is disabled until the slug is typed exactly
 *  - button becomes enabled when the typed value matches the slug
 *
 * The panel calls server actions; mock them so the dialog can be exercised
 * without a real DB connection.
 */
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { DangerPanel } from "./_panel";

// Mock the server actions imported by the panel
vi.mock("../_actions", () => ({
  requestDataExportAction: vi.fn().mockResolvedValue({ ok: true }),
  deleteWorkspaceAction: vi.fn().mockResolvedValue({ ok: true }),
}));

// DangerPanel uses useRouter from the i18n navigation — stubbed via vitest alias.

const WORKSPACE_NAME = "Sarah Photography";
const WORKSPACE_SLUG = "sarah-photo";

function renderPanel() {
  return renderWithProviders(
    <DangerPanel workspaceName={WORKSPACE_NAME} workspaceSlug={WORKSPACE_SLUG} />
  );
}

/** Open the delete dialog by clicking the destructive button (not the heading). */
function openDeleteDialog() {
  // There are two elements with "Delete workspace" text: the section heading
  // and the open-dialog button. We want the button.
  const buttons = screen.getAllByRole("button", { name: /delete workspace/i });
  fireEvent.click(buttons[0]);
}

describe("DangerPanel — delete confirmation", () => {
  it("confirm button is disabled before any input", () => {
    renderPanel();
    openDeleteDialog();

    const confirmBtn = screen.getByRole("button", {
      name: /i understand, delete it/i,
    });
    expect(confirmBtn).toBeDisabled();
  });

  it("confirm button is disabled when typed value is wrong", () => {
    renderPanel();
    openDeleteDialog();

    const input = screen.getByPlaceholderText(WORKSPACE_SLUG);
    fireEvent.change(input, { target: { value: "wrong-slug" } });

    const confirmBtn = screen.getByRole("button", {
      name: /i understand, delete it/i,
    });
    expect(confirmBtn).toBeDisabled();
  });

  it("confirm button becomes enabled when typed value matches exactly", () => {
    renderPanel();
    openDeleteDialog();

    const input = screen.getByPlaceholderText(WORKSPACE_SLUG);
    fireEvent.change(input, { target: { value: WORKSPACE_SLUG } });

    const confirmBtn = screen.getByRole("button", {
      name: /i understand, delete it/i,
    });
    expect(confirmBtn).not.toBeDisabled();
  });

  it("confirm button stays disabled after clearing the input", () => {
    renderPanel();
    openDeleteDialog();

    const input = screen.getByPlaceholderText(WORKSPACE_SLUG);
    fireEvent.change(input, { target: { value: WORKSPACE_SLUG } });
    // Now clear it
    fireEvent.change(input, { target: { value: "" } });

    const confirmBtn = screen.getByRole("button", {
      name: /i understand, delete it/i,
    });
    expect(confirmBtn).toBeDisabled();
  });
});
