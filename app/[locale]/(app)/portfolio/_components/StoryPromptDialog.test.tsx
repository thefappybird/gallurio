import { beforeEach, describe, it, expect, vi } from "vitest";
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

// A single stable requestCrop mock shared across every render — the dialog
// re-renders on each step/state change, so a per-render override would be
// consumed by an unrelated render instead of the actual file-input change.
const requestCropMock = vi.fn(async (file: File) => ({ status: "ok" as const, file }));
vi.mock("@/lib/media/useImageCropper", () => ({
  useImageCropper: () => ({
    cropDialog: null,
    requestCrop: requestCropMock,
  }),
}));

import { toast } from "sonner";
import { tagBorderClass } from "@/components/app/tag-pill";
import { StoryPromptDialog } from "./StoryPromptDialog";

function setup(props: Partial<React.ComponentProps<typeof StoryPromptDialog>> = {}) {
  return renderWithProviders(
    <StoryPromptDialog
      open
      workspaceName="Studio Aurora"
      initialDescription=""
      initialKeywords={[]}
      initialInquiryRecipientEmail="owner@example.com"
      businessType="photographer"
      onContinueWithGuide={vi.fn()}
      onExploreSelf={vi.fn()}
      {...props}
    />
  );
}

describe("StoryPromptDialog", () => {
  beforeEach(() => {
    completeStoryPromptAction.mockClear();
    uploadAsset.mockReset();
    requestCropMock.mockClear();
    requestCropMock.mockImplementation(async (file: File) => ({ status: "ok" as const, file }));
  });

  it("shows the welcome step title when open", () => {
    setup();
    expect(screen.getByText(/let's tell your story/i)).toBeInTheDocument();
  });

  it("uses a larger onboarding-styled modal while keeping the form centered", () => {
    setup();
    const dialog = document.querySelector('[data-slot="dialog-content"]');
    expect(dialog).toHaveClass("sm:max-w-3xl");
    expect(dialog).toHaveClass("sm:min-h-[480px]");
    expect(dialog).toHaveClass("bg-onboarding-bg");
    expect(dialog?.querySelector(".max-w-lg")).toBeInTheDocument();
    expect(dialog?.querySelector('img[src*="/onboarding/background-light.svg"]')).toBeInTheDocument();
    expect(dialog?.querySelector('img[src*="/onboarding/background-dark.svg"]')).toBeInTheDocument();
  });

  it("keeps middle-step actions pinned to the bottom without a sticky background", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /let's go/i }));
    const footer = screen.getByTestId("story-prompt-action-footer");
    expect(footer).toHaveClass("mt-auto");
    expect(footer).not.toHaveClass("sticky", "bg-onboarding-bg/95", "border-t");
  });

  it("centers the final step actions without the bottom action footer", async () => {
    setup();
    await goToDoneStep();
    expect(screen.getByRole("heading", { name: /your page is ready to shine/i })).toBeInTheDocument();
    expect(screen.queryByTestId("story-prompt-action-footer")).not.toBeInTheDocument();
  });

  it("advances to the story step when Let's go is clicked", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /let's go/i }));
    expect(screen.getByRole("heading", { name: /^tell your story$/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/who you are and what you do/i)).toBeInTheDocument();
  });

  it("lets reached step circles navigate back to previous steps", async () => {
    setup();
    await goToVibeStep();

    expect(screen.getByRole("button", { name: "Step 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Step 3" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "Step 4" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Step 4" })).toHaveClass("bg-foreground/25");
    expect(screen.getByRole("button", { name: "Step 4" })).not.toHaveClass("bg-muted");

    fireEvent.click(screen.getByRole("button", { name: "Step 2" }));
    expect(screen.getByRole("heading", { name: /^tell your story$/i })).toBeInTheDocument();
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
        ogImageUrl: "",
        ogImageAssetId: "",
        inquiryRecipientEmail: "owner@example.com",
      });
      expect(onExploreSelf).toHaveBeenCalled();
    });
  });

  it("skips persistence when opened as a preview", async () => {
    const onExploreSelf = vi.fn();
    setup({ onExploreSelf, persistOnExit: false });
    fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));
    await waitFor(() => expect(onExploreSelf).toHaveBeenCalled());
    expect(completeStoryPromptAction).not.toHaveBeenCalled();
  });

  it("shows a live search preview reflecting the typed description", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /let's go/i }));
    const textarea = screen.getByPlaceholderText(/who you are and what you do/i);
    fireEvent.change(textarea, { target: { value: "We shoot candid weddings." } });
    expect(screen.getByText(/gallurio\.com › w › studio-aurora/i)).toBeInTheDocument();
    expect(screen.getAllByText("We shoot candid weddings.")).toHaveLength(2);
  });

  it("renders the search preview badge with an explicit visible text color", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /let's go/i }));
    const badge = screen.getByText("S", { selector: "span" });
    expect(badge).toHaveStyle({ color: "#e8eaed" });
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
    expect(chip).toHaveClass(tagBorderClass("Documentary"));
    expect(chip).toHaveClass("bg-popover");
    fireEvent.click(chip);
    expect(chip).toHaveClass(tagBorderClass("Documentary"));
    expect(chip).toHaveClass("bg-accent");
    expect(chip).toHaveClass("text-accent-foreground");
  });

  it("adds a free-text tag as a new selected chip", async () => {
    setup({ businessType: "photographer" });
    await goToVibeStep();
    const input = screen.getByPlaceholderText(/add a tag/i);
    fireEvent.change(input, { target: { value: "Moody" } });
    fireEvent.click(screen.getByRole("button", { name: /add a tag/i }));
    expect(screen.getByRole("button", { name: "Moody" })).toHaveClass(tagBorderClass("Moody"));
    expect(screen.queryByRole("button", { name: "Remove draft Moody" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add a tag/i })).toBeDisabled();
  });

  it("creates an inline draft chip when space is pressed", async () => {
    setup({ businessType: "photographer" });
    await goToVibeStep();
    const input = screen.getByPlaceholderText(/add a tag/i);
    fireEvent.change(input, { target: { value: "Moody" } });
    fireEvent.keyDown(input, { key: " " });

    expect(screen.getByText("Moody")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove draft Moody" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add a tag/i })).toBeEnabled();
    expect(input).toHaveValue("");
  });

  it("creates an inline draft chip when the input value receives a trailing space", async () => {
    setup({ businessType: "photographer" });
    await goToVibeStep();
    const input = screen.getByPlaceholderText(/add a tag/i);
    fireEvent.change(input, { target: { value: "Moody " } });

    expect(screen.getByText("Moody")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove draft Moody" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add a tag/i })).toBeEnabled();
    expect(input).toHaveValue("");
  });

  it("adds the typed word as a tag through the add tag form", async () => {
    setup({ businessType: "photographer" });
    await goToVibeStep();
    const input = screen.getByPlaceholderText(/add a tag/i);
    fireEvent.change(input, { target: { value: "Warm" } });
    const form = input.closest("form");
    expect(form).toBeInTheDocument();
    fireEvent.submit(form as HTMLFormElement);

    expect(screen.getByRole("button", { name: "Warm" })).toHaveClass(tagBorderClass("Warm"));
    expect(screen.queryByRole("button", { name: "Remove draft Warm" })).not.toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("moves the last draft tag back into the input on empty backspace", async () => {
    setup({ businessType: "photographer" });
    await goToVibeStep();
    const input = screen.getByPlaceholderText(/add a tag/i);
    fireEvent.change(input, { target: { value: "Moody" } });
    fireEvent.keyDown(input, { key: " " });
    fireEvent.keyDown(input, { key: "Backspace" });

    expect(input).toHaveValue("Moody");
    expect(screen.queryByText("Moody")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove draft Moody" })).not.toBeInTheDocument();
  });

  it("gives the add tag icon button a hover title", async () => {
    setup({ businessType: "photographer" });
    await goToVibeStep();
    expect(screen.getByRole("button", { name: /add a tag/i })).toHaveAttribute("title", "Add a tag");
  });

  it("moves inline chips to registered preview chips and submits them as the keywords array", async () => {
    const onContinueWithGuide = vi.fn();
    setup({ onContinueWithGuide });
    await goToVibeStep();
    const input = screen.getByPlaceholderText(/add a tag/i);
    fireEvent.change(input, { target: { value: "Moody " } });
    fireEvent.click(screen.getByRole("button", { name: /add a tag/i }));
    expect(screen.queryByRole("button", { name: "Remove draft Moody" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Moody" })).toHaveClass(tagBorderClass("Moody"));

    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    await screen.findByRole("heading", { name: /add your branding/i });
    await waitForSingle(/^continue$/i);
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    await screen.findByRole("button", { name: /continue with guide/i });
    fireEvent.click(screen.getByRole("button", { name: /continue with guide/i }));

    await waitFor(() => {
      expect(completeStoryPromptAction).toHaveBeenCalledWith({
        description: "",
        keywords: ["Moody"],
        logoUrl: "",
        logoAssetId: "",
        siteIconUrl: "",
        siteIconAssetId: "",
        ogImageUrl: "",
        ogImageAssetId: "",
        inquiryRecipientEmail: "owner@example.com",
      });
      expect(onContinueWithGuide).toHaveBeenCalled();
    });
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
    expect(screen.getByLabelText(/inquiry recipient email/i)).toHaveClass("bg-popover", "dark:bg-popover");
    expect(screen.getByText(/new inquiry notifications/i)).toHaveClass("dark:text-foreground");
  });

  it("uploads a logo on the branding step and shows a preview", async () => {
    uploadAsset.mockResolvedValueOnce({ asset: { assetId: "logo-1", url: "https://cdn/logo.png" } });
    setup();
    await goToBrandingStep();
    const fileInput = document.querySelector('input[type="file"][accept="image/png,image/jpeg,image/webp"]') as HTMLInputElement;
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(document.querySelector('img[src="https://cdn/logo.png"]')).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /remove logo/i })).toBeInTheDocument();
  });

  it("hands the cropped file (not the original) to uploadAsset for the logo", async () => {
    requestCropMock.mockResolvedValueOnce({
      status: "ok",
      file: new File(["cropped"], "cropped.webp", { type: "image/webp" }),
    });
    uploadAsset.mockResolvedValueOnce({ asset: { assetId: "logo-1", url: "https://cdn/logo.png" } });
    setup();
    await goToBrandingStep();
    const fileInput = document.querySelector('input[type="file"][accept="image/png,image/jpeg,image/webp"]') as HTMLInputElement;
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() =>
      expect(uploadAsset).toHaveBeenCalledWith(
        expect.objectContaining({ name: "cropped.webp", type: "image/webp" }),
        expect.anything(),
        expect.anything(),
      ),
    );
  });

  it("hands the cropped file (not the original) to uploadAsset for the site icon", async () => {
    requestCropMock.mockResolvedValueOnce({
      status: "ok",
      file: new File(["cropped"], "cropped-icon.webp", { type: "image/webp" }),
    });
    uploadAsset.mockResolvedValueOnce({ asset: { assetId: "icon-1", url: "https://cdn/icon.png" } });
    setup();
    await goToBrandingStep();
    const fileInput = document.getElementById("story-prompt-icon-file") as HTMLInputElement;
    const file = new File(["icon"], "icon.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() =>
      expect(uploadAsset).toHaveBeenCalledWith(
        expect.objectContaining({ name: "cropped-icon.webp", type: "image/webp" }),
        expect.anything(),
        expect.anything(),
      ),
    );
  });

  it("accepts a dropped logo or site icon on the branding step", async () => {
    uploadAsset.mockResolvedValueOnce({ asset: { assetId: "logo-drop", url: "https://cdn/logo-drop.png" } });
    setup();
    await goToBrandingStep();
    fireEvent.drop(screen.getByTestId("story-prompt-logo-dropzone"), {
      dataTransfer: { files: [new File(["logo"], "logo.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(document.querySelector('img[src="https://cdn/logo-drop.png"]')).toBeInTheDocument());
  });

  it("shows a mapped error message when the logo upload fails validation", async () => {
    uploadAsset.mockResolvedValueOnce({ error: "file_too_large" });
    setup();
    await goToBrandingStep();
    const fileInput = document.querySelector('input[type="file"][accept="image/png,image/jpeg,image/webp"]') as HTMLInputElement;
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
        ogImageUrl: "",
        ogImageAssetId: "",
        inquiryRecipientEmail: "owner@example.com",
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
      'input[type="file"][accept="image/png,image/jpeg,image/webp"]'
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
        ogImageUrl: "",
        ogImageAssetId: "",
        inquiryRecipientEmail: "owner@example.com",
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
