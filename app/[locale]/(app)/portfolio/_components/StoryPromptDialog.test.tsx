import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

const completeStoryPromptAction = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../_actions", () => ({
  completeStoryPromptAction: (...a: unknown[]) => completeStoryPromptAction(...a),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const uploadAsset = vi.fn();
vi.mock("@/lib/storage/uploadAsset.client", () => ({
  uploadAsset: (...a: unknown[]) => uploadAsset(...a),
}));

import { toast } from "sonner";
import { StoryPromptDialog } from "./StoryPromptDialog";

function setup(props: Partial<React.ComponentProps<typeof StoryPromptDialog>> = {}) {
  return renderWithProviders(
    <StoryPromptDialog
      open
      workspaceName="Studio Aurora"
      initialDescription=""
      initialKeywords={[]}
      businessType="photographer"
      onContinueWithGuide={vi.fn()}
      onExploreSelf={vi.fn()}
      {...props}
    />
  );
}

describe("StoryPromptDialog", () => {
  it("shows the welcome step title when open", () => {
    setup();
    expect(screen.getByText(/let's tell your story/i)).toBeInTheDocument();
  });

  it("advances to the story step when Let's go is clicked", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /let's go/i }));
    expect(screen.getByRole("heading", { name: /^tell your story$/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/who you are and what you do/i)).toBeInTheDocument();
  });

  it("shows a live character count as the description is typed", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /let's go/i }));
    const textarea = screen.getByPlaceholderText(/who you are and what you do/i);
    fireEvent.change(textarea, { target: { value: "Hello" } });
    expect(screen.getByText("5/300")).toBeInTheDocument();
  });

  it("skips from the welcome step, saving and exiting via explore", async () => {
    const onExploreSelf = vi.fn();
    setup({ onExploreSelf });
    fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));
    await waitFor(() => {
      expect(completeStoryPromptAction).toHaveBeenCalledWith({
        description: "",
        keywords: [],
        logoUrl: "",
        logoAssetId: "",
        siteIconUrl: "",
        siteIconAssetId: "",
      });
      expect(onExploreSelf).toHaveBeenCalled();
    });
  });

  it("shows a live search preview reflecting the typed description", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /let's go/i }));
    const textarea = screen.getByPlaceholderText(/who you are and what you do/i);
    fireEvent.change(textarea, { target: { value: "We shoot candid weddings." } });
    expect(screen.getByText(/gallurio\.com › w › studio-aurora/i)).toBeInTheDocument();
    expect(screen.getAllByText("We shoot candid weddings.")).toHaveLength(2);
  });

  async function waitForSingle(name: RegExp) {
    await waitFor(() => expect(screen.getAllByRole("button", { name })).toHaveLength(1));
  }

  async function goToVibeStep() {
    fireEvent.click(screen.getByRole("button", { name: /let's go/i }));
    await screen.findByRole("heading", { name: /^tell your story$/i });
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    await screen.findByRole("heading", { name: /^your vibe$/i });
    await waitForSingle(/^continue$/i);
  }

  it("shows photographer suggested tags on the vibe step and toggles selection", async () => {
    setup({ businessType: "photographer" });
    await goToVibeStep();
    const chip = screen.getByRole("button", { name: "Documentary" });
    expect(chip).toHaveClass("border-border");
    fireEvent.click(chip);
    expect(chip).toHaveClass("bg-primary");
  });

  it("adds a free-text tag as a new selected chip", async () => {
    setup({ businessType: "photographer" });
    await goToVibeStep();
    const input = screen.getByPlaceholderText(/add a tag/i);
    fireEvent.change(input, { target: { value: "Moody" } });
    fireEvent.click(screen.getByRole("button", { name: /add a tag/i }));
    const chip = screen.getByRole("button", { name: "Moody" });
    expect(chip).toHaveClass("bg-primary");
  });

  it("truncates a custom tag longer than 40 characters before adding it", async () => {
    setup({ businessType: "photographer" });
    await goToVibeStep();
    const longTag = "a".repeat(50);
    const input = screen.getByPlaceholderText(/add a tag/i);
    fireEvent.change(input, { target: { value: longTag } });
    fireEvent.click(screen.getByRole("button", { name: /add a tag/i }));
    expect(screen.getByRole("button", { name: "a".repeat(40) })).toBeInTheDocument();
  });

  async function goToBrandingStep() {
    await goToVibeStep();
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    await screen.findByRole("heading", { name: /add your branding/i });
    await waitForSingle(/^continue$/i);
  }

  async function goToDoneStep() {
    await goToBrandingStep();
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    await screen.findByRole("heading", { name: /your page is ready to shine/i });
  }

  it("shows the branding step after continuing from vibe", async () => {
    setup();
    await goToBrandingStep();
    expect(screen.getByRole("heading", { name: /add your branding/i })).toBeInTheDocument();
  });

  it("uploads a logo on the branding step and shows a preview", async () => {
    uploadAsset.mockResolvedValueOnce({ asset: { assetId: "logo-1", url: "https://cdn/logo.png" } });
    setup();
    await goToBrandingStep();
    const fileInput = document.querySelector('input[type="file"][accept*="image/png,image/jpeg,image/webp"]') as HTMLInputElement;
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(document.querySelector('img[src="https://cdn/logo.png"]')).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /remove logo/i })).toBeInTheDocument();
  });

  it("shows a mapped error message when the logo upload fails validation", async () => {
    uploadAsset.mockResolvedValueOnce({ error: "file_too_large" });
    setup();
    await goToBrandingStep();
    const fileInput = document.querySelector('input[type="file"][accept*="image/png,image/jpeg,image/webp"]') as HTMLInputElement;
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/250 KB or smaller/i);
  });

  it("uploads a site icon on the branding step and shows a preview", async () => {
    uploadAsset.mockResolvedValueOnce({ asset: { assetId: "icon-1", url: "https://cdn/icon.png" } });
    setup();
    await goToBrandingStep();
    const fileInput = document.getElementById("story-prompt-icon-file") as HTMLInputElement;
    const file = new File(["icon"], "icon.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(document.querySelector('img[src="https://cdn/icon.png"]')).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /^remove$/i })).toBeInTheDocument();
  });

  it("saves and continues with guide from the done step", async () => {
    const onContinueWithGuide = vi.fn();
    setup({ onContinueWithGuide, initialDescription: "Hi", initialKeywords: ["Candid"] });
    await goToDoneStep();
    await screen.findByRole("button", { name: /continue with guide/i });
    fireEvent.click(screen.getByRole("button", { name: /continue with guide/i }));
    await waitFor(() => {
      expect(completeStoryPromptAction).toHaveBeenCalledWith({
        description: "Hi",
        keywords: ["Candid"],
        logoUrl: "",
        logoAssetId: "",
        siteIconUrl: "",
        siteIconAssetId: "",
      });
      expect(onContinueWithGuide).toHaveBeenCalled();
    });
  });

  it("completes the full walkthrough with description, vibe, logo, and icon", async () => {
    uploadAsset
      .mockResolvedValueOnce({ asset: { assetId: "logo-1", url: "https://cdn/logo.png" } })
      .mockResolvedValueOnce({ asset: { assetId: "icon-1", url: "https://cdn/icon.png" } });
    const onContinueWithGuide = vi.fn();
    setup({ onContinueWithGuide });

    fireEvent.click(screen.getByRole("button", { name: /let's go/i }));
    await screen.findByRole("heading", { name: /^tell your story$/i });
    fireEvent.change(screen.getByPlaceholderText(/who you are and what you do/i), {
      target: { value: "Full walkthrough studio." },
    });
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    await screen.findByRole("heading", { name: /^your vibe$/i });
    await waitForSingle(/^continue$/i);
    fireEvent.click(screen.getByRole("button", { name: "Documentary" }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    await screen.findByRole("heading", { name: /add your branding/i });
    await waitForSingle(/^continue$/i);
    const logoInput = document.querySelector(
      'input[type="file"][accept*="image/png,image/jpeg,image/webp"]'
    ) as HTMLInputElement;
    fireEvent.change(logoInput, { target: { files: [new File(["logo"], "logo.png", { type: "image/png" })] } });
    await waitFor(() => expect(document.querySelector('img[src="https://cdn/logo.png"]')).toBeInTheDocument());
    const iconInput = document.getElementById("story-prompt-icon-file") as HTMLInputElement;
    fireEvent.change(iconInput, { target: { files: [new File(["icon"], "icon.png", { type: "image/png" })] } });
    await waitFor(() => expect(document.querySelector('img[src="https://cdn/icon.png"]')).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    await screen.findByRole("button", { name: /continue with guide/i });
    fireEvent.click(screen.getByRole("button", { name: /continue with guide/i }));

    await waitFor(() => {
      expect(completeStoryPromptAction).toHaveBeenCalledWith({
        description: "Full walkthrough studio.",
        keywords: ["Documentary"],
        logoUrl: "https://cdn/logo.png",
        logoAssetId: "logo-1",
        siteIconUrl: "https://cdn/icon.png",
        siteIconAssetId: "icon-1",
      });
      expect(onContinueWithGuide).toHaveBeenCalled();
    });
  });

  it("shows an error toast and does not exit when the save action fails", async () => {
    completeStoryPromptAction.mockResolvedValueOnce({ error: "save_failed" });
    const onExploreSelf = vi.fn();
    setup({ onExploreSelf });
    await goToDoneStep();
    await screen.findByRole("button", { name: /explore myself/i });
    fireEvent.click(screen.getByRole("button", { name: /explore myself/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(onExploreSelf).not.toHaveBeenCalled();
  });
});
