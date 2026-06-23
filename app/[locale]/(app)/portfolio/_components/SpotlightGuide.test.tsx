import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { SpotlightGuide, type SpotlightStep } from "./SpotlightGuide";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STEPS: SpotlightStep[] = [
  {
    id: "welcome",
    title: "Welcome to the tour",
    body: "This is the first step.",
  },
  {
    id: "anchor-step",
    anchorId: "my-anchor",
    title: "Anchor step",
    body: "This step has an anchor element.",
    placement: "bottom",
  },
  {
    id: "gated-step",
    anchorId: "gated-anchor",
    title: "Gated step",
    body: "Try dragging a block.",
    gated: true,
  },
  {
    id: "last-step",
    title: "Last step",
    body: "You made it!",
  },
];

const defaultProps = {
  open: true,
  steps: STEPS,
  stepIndex: 0,
  onStepChange: vi.fn(),
  gateSatisfied: false,
  onSkip: vi.fn(),
  onFinish: vi.fn(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderGuide(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<SpotlightGuide {...props} />);
}

/** Inject an anchor element into document.body and return a cleanup fn. */
function injectAnchor(id: string, rect?: Partial<DOMRect>): () => void {
  const el = document.createElement("div");
  el.setAttribute("data-tour-id", id);
  el.style.width = "100px";
  el.style.height = "40px";
  el.style.position = "absolute";
  el.style.top = "200px";
  el.style.left = "150px";

  // happy-dom: getBoundingClientRect returns zeros by default; override it
  el.getBoundingClientRect = () =>
    ({
      top: 200,
      left: 150,
      width: 100,
      height: 40,
      bottom: 240,
      right: 250,
      ...rect,
      toJSON() {
        return this;
      },
    }) as DOMRect;

  document.body.appendChild(el);
  return () => el.remove();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("SpotlightGuide", () => {
  // ── Visibility ──────────────────────────────────────────────────────────────

  it("renders nothing when open is false", () => {
    renderGuide({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the active step's title and body", () => {
    renderGuide({ stepIndex: 0 });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Welcome to the tour")).toBeInTheDocument();
    expect(screen.getByText("This is the first step.")).toBeInTheDocument();
  });

  // ── Progress ────────────────────────────────────────────────────────────────

  it("shows correct progress text", () => {
    renderGuide({ stepIndex: 1 });
    // "2 of 4"
    expect(screen.getByText("2 of 4")).toBeInTheDocument();
  });

  it("shows progress for the last step", () => {
    renderGuide({ stepIndex: STEPS.length - 1 });
    expect(screen.getByText(`${STEPS.length} of ${STEPS.length}`)).toBeInTheDocument();
  });

  // ── Navigation: Next / Back ──────────────────────────────────────────────────

  it("Next calls onStepChange with stepIndex+1", () => {
    const onStepChange = vi.fn();
    renderGuide({ stepIndex: 0, onStepChange });
    fireEvent.click(screen.getByRole("button", { name: /^Next$/i }));
    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  it("Back calls onStepChange with stepIndex-1", () => {
    const onStepChange = vi.fn();
    renderGuide({ stepIndex: 2, onStepChange });
    fireEvent.click(screen.getByRole("button", { name: /^Back$/i }));
    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  it("does not render a Back button on the first step", () => {
    renderGuide({ stepIndex: 0 });
    expect(screen.queryByRole("button", { name: /^Back$/i })).toBeNull();
  });

  it("renders Skip (not Back) on the first step", () => {
    renderGuide({ stepIndex: 0 });
    expect(screen.getByRole("button", { name: /^Skip$/i })).toBeInTheDocument();
  });

  // ── Last step: Finish ────────────────────────────────────────────────────────

  it("last step renders Finish instead of Next", () => {
    renderGuide({ stepIndex: STEPS.length - 1 });
    expect(screen.getByRole("button", { name: /^Finish$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Next$/i })).toBeNull();
  });

  it("Finish calls onFinish(false) when clicked without dont-show-again", () => {
    const onFinish = vi.fn();
    renderGuide({ stepIndex: STEPS.length - 1, onFinish });
    fireEvent.click(screen.getByRole("button", { name: /^Finish$/i }));
    expect(onFinish).toHaveBeenCalledWith(false);
  });

  // ── Skip ─────────────────────────────────────────────────────────────────────

  it("Skip (first step) calls onSkip(false)", () => {
    const onSkip = vi.fn();
    renderGuide({ stepIndex: 0, onSkip });
    fireEvent.click(screen.getByRole("button", { name: /^Skip$/i }));
    expect(onSkip).toHaveBeenCalledWith(false);
  });

  // ── Don't show again ─────────────────────────────────────────────────────────

  it("'Don't show again' calls onSkip(true) on a non-last step", () => {
    const onSkip = vi.fn();
    renderGuide({ stepIndex: 1, onSkip });
    fireEvent.click(screen.getByRole("button", { name: /Don't show again/i }));
    expect(onSkip).toHaveBeenCalledWith(true);
  });

  it("'Don't show again' calls onFinish(true) on the last step", () => {
    const onFinish = vi.fn();
    renderGuide({ stepIndex: STEPS.length - 1, onFinish });
    fireEvent.click(screen.getByRole("button", { name: /Don't show again/i }));
    expect(onFinish).toHaveBeenCalledWith(true);
  });

  // ── Esc closes ───────────────────────────────────────────────────────────────

  it("Esc key calls onSkip(false)", () => {
    const onSkip = vi.fn();
    renderGuide({ stepIndex: 0, onSkip });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onSkip).toHaveBeenCalledWith(false);
  });

  // ── Gated step ───────────────────────────────────────────────────────────────

  it("shows the 'Try it to continue' hint and never renders a 'Skip this step' button on a gated step (1a fix)", () => {
    renderGuide({ stepIndex: 2 }); // STEPS[2] is gated
    // Updated copy: "Try it to continue to the next step"
    expect(screen.getByText(/Try it to continue to the next step/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Skip this step/i })).toBeNull();
  });

  it("shows Next on a gated step once its gate is already satisfied (e.g. stepped Back onto a completed step)", () => {
    renderGuide({ stepIndex: 2, gateSatisfied: true });
    expect(screen.getByRole("button", { name: /^Next$/i })).toBeInTheDocument();
  });

  it("auto-advances when gateSatisfied flips to true on a gated step", () => {
    const onStepChange = vi.fn();
    const { rerender } = renderGuide({
      stepIndex: 2,
      gateSatisfied: false,
      onStepChange,
    });

    expect(onStepChange).not.toHaveBeenCalled();

    act(() => {
      rerender(
        <SpotlightGuide
          open={true}
          steps={STEPS}
          stepIndex={2}
          onStepChange={onStepChange}
          gateSatisfied={true}
          onSkip={vi.fn()}
          onFinish={vi.fn()}
        />
      );
    });

    expect(onStepChange).toHaveBeenCalledWith(3);
  });

  it("does NOT auto-advance if gateSatisfied is already true on mount (no prev-false transition)", () => {
    const onStepChange = vi.fn();
    // Render with gateSatisfied true from the start — prevGateSatisfied.current
    // starts as the initial value (true), so wasUnsatisfied is false → no advance.
    renderGuide({ stepIndex: 2, gateSatisfied: true, onStepChange });
    expect(onStepChange).not.toHaveBeenCalled();
  });

  // ── Missing anchor ───────────────────────────────────────────────────────────

  it("renders (recentered) without throwing when anchorId is missing from DOM", () => {
    // STEPS[1] has anchorId="my-anchor" but we don't inject the element
    expect(() => renderGuide({ stepIndex: 1 })).not.toThrow();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Anchor step")).toBeInTheDocument();
  });

  it("renders correctly when no anchorId is defined on the step", () => {
    // STEPS[0] has no anchorId — should center without querying DOM
    expect(() => renderGuide({ stepIndex: 0 })).not.toThrow();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // ── Anchor present ────────────────────────────────────────────────────────────

  it("renders step content correctly when the anchor element exists in the DOM", () => {
    const removeAnchor = injectAnchor("my-anchor");
    try {
      renderGuide({ stepIndex: 1 });
      expect(screen.getByText("Anchor step")).toBeInTheDocument();
      expect(screen.getByText("This step has an anchor element.")).toBeInTheDocument();
    } finally {
      removeAnchor();
    }
  });

  // ── Step content at different indices ────────────────────────────────────────

  it("renders the correct step title when stepIndex changes (rerender)", () => {
    const { rerender } = renderGuide({ stepIndex: 0 });
    expect(screen.getByText("Welcome to the tour")).toBeInTheDocument();

    rerender(
      <SpotlightGuide
        {...defaultProps}
        stepIndex={1}
      />
    );
    expect(screen.getByText("Anchor step")).toBeInTheDocument();
    expect(screen.queryByText("Welcome to the tour")).toBeNull();
  });

  // ── Footer layout: gated step with all 4 buttons ─────────────────────────────

  it("unsatisfied gated non-first step shows Don't show again + Back, but no Skip-this-step and no Next", () => {
    // STEPS[2] is gated; stepIndex=2 → not first, not last, gated, unsatisfied
    renderGuide({ stepIndex: 2, gateSatisfied: false });

    expect(screen.getByRole("button", { name: /Don't show again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Back$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Skip this step/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Next$/i })).toBeNull();
  });
});
