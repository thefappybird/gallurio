import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

const completeStoryPromptAction = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../_actions", () => ({
  completeStoryPromptAction: (...a: unknown[]) => completeStoryPromptAction(...a),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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

  it("saves and continues with guide from the done step", async () => {
    const onContinueWithGuide = vi.fn();
    setup({ onContinueWithGuide, initialDescription: "Hi", initialKeywords: ["Candid"] });
    await goToVibeStep();
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    await screen.findByRole("button", { name: /continue with guide/i });
    fireEvent.click(screen.getByRole("button", { name: /continue with guide/i }));
    await waitFor(() => {
      expect(completeStoryPromptAction).toHaveBeenCalledWith({ description: "Hi", keywords: ["Candid"] });
      expect(onContinueWithGuide).toHaveBeenCalled();
    });
  });

  it("shows an error toast and does not exit when the save action fails", async () => {
    completeStoryPromptAction.mockResolvedValueOnce({ error: "save_failed" });
    const onExploreSelf = vi.fn();
    setup({ onExploreSelf });
    await goToVibeStep();
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    await screen.findByRole("button", { name: /explore myself/i });
    fireEvent.click(screen.getByRole("button", { name: /explore myself/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(onExploreSelf).not.toHaveBeenCalled();
  });
});
