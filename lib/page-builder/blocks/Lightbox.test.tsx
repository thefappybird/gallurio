import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, act, fireEvent } from "@testing-library/react";
import { Lightbox, type LightboxImage } from "./Lightbox";

const OLD = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
beforeEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = "test-hash";
});
afterEach(() => {
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = OLD;
});

function img(id: string, extra: Partial<LightboxImage> = {}): LightboxImage {
  return { id, publicId: `workspace/${id}`, alt: `Photo ${id}`, ...extra };
}

describe("Lightbox — legacy single-image call", () => {
  it("renders the dialog with the image and no nav controls", () => {
    render(<Lightbox image={img("a")} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByAltText("Photo a")).toHaveAttribute("src", expect.stringContaining("workspace/a"));
    expect(screen.queryByRole("button", { name: /next image/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /previous image/i })).not.toBeInTheDocument();
  });

  it("defaults to caption when no layout is passed", () => {
    render(<Lightbox image={img("a")} onClose={() => {}} />);
    expect(document.querySelector(".pf-modal-sidebar")).not.toBeInTheDocument();
  });

  // Item 12, "genuine second bug": Lightbox.tsx:279-281 used to hardcode
  // layout="caption" for the legacy `image=` call shape, ignoring any passed
  // `layout` outright. No production caller currently exercises this (both
  // real callers already use the `images=` shape), but the signature itself
  // must honor it now that LightboxLegacyProps carries `layout`.
  it("honors a passed layout on the legacy image= call shape (Item 12)", () => {
    render(<Lightbox image={img("full", { title: "T" })} layout="sidebar" onClose={() => {}} />);
    expect(document.querySelector(".pf-modal-sidebar")).toBeInTheDocument();
  });
});

describe("Lightbox — navigation gated by images.length", () => {
  it("a single-item images array cannot show navigation, by construction", () => {
    render(<Lightbox images={[img("solo")]} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: /next image/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /previous image/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });

  it("shows prev/next and dot pagination (total <= 8) once there is more than one image", () => {
    render(<Lightbox images={[img("a"), img("b"), img("c")]} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /next image/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous image/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Photo 1 of 3" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /previous image/i })).toBeDisabled();
  });

  it("arrow keys move the current image and update the marked dot", () => {
    render(<Lightbox images={[img("a"), img("b")]} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(screen.getByRole("button", { name: "Photo 1 of 2" })).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "Photo 2 of 2" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /next image/i })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(screen.getByRole("button", { name: "Photo 1 of 2" })).toHaveAttribute("aria-current", "true");
  });
});

describe("Lightbox — paging at the loaded end", () => {
  it("calls onRequestMore and shows a pending next control when hasMore is true", async () => {
    const onRequestMore = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <Lightbox images={[img("a"), img("b")]} total={4} hasMore onRequestMore={onRequestMore} onClose={() => {}} />
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowRight" }); // move to the last loaded item (index 1)
    const next = screen.getByRole("button", { name: /next image/i });
    expect(next).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(next);
    });
    expect(onRequestMore).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /next image/i })).toHaveAttribute("aria-busy", "true");

    // Parent loads page 2 and grows the array — Lightbox should auto-advance.
    await act(async () => {
      rerender(
        <Lightbox
          images={[img("a"), img("b"), img("c")]}
          total={4}
          hasMore
          onRequestMore={onRequestMore}
          onClose={() => {}}
        />
      );
    });
    expect(screen.getByRole("button", { name: "Photo 3 of 4" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /next image/i })).not.toHaveAttribute("aria-busy");
  });

  it("disables next at the true end when hasMore is false", () => {
    render(<Lightbox images={[img("a"), img("b")]} hasMore={false} onClose={() => {}} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: /next image/i })).toBeDisabled();
  });
});

describe("Lightbox — layouts degrade gracefully with only alt", () => {
  const bareImage = img("bare");

  it.each(["caption", "sidebar", "cinema", "sheet"] as const)("%s renders with only alt, no empty headings or dl", (layout) => {
    render(<Lightbox images={[bareImage]} layout={layout} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByAltText("Photo bare").length).toBeGreaterThan(0);
    expect(within(dialog).queryAllByRole("heading")).toHaveLength(0);
    expect(within(dialog).queryByRole("list")).not.toBeInTheDocument();
  });

  it("sidebar renders every metadata group when present", () => {
    render(
      <Lightbox
        images={[
          img("full", {
            title: "Golden Hour",
            caption: "Reception at dusk",
            date: "2026-06-01",
            location: "Manila",
            client: "Cruz Wedding",
            meta: [{ label: "Camera", value: "GFX100" }],
            tags: ["wedding", "reception"],
            width: 1920,
            height: 1280,
          }),
        ]}
        layout="sidebar"
        onClose={() => {}}
      />
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Golden Hour")).toBeInTheDocument();
    expect(within(dialog).getByText("Reception at dusk")).toBeInTheDocument();
    expect(within(dialog).getByText("Manila")).toBeInTheDocument();
    expect(within(dialog).getByText("Camera")).toBeInTheDocument();
    expect(within(dialog).getByText("wedding")).toBeInTheDocument();
    expect(within(dialog).getByText("1920 × 1280 px")).toBeInTheDocument();
  });
});

describe("Lightbox — cinema filmstrip", () => {
  it("exposes the filmstrip as a listbox with the current frame marked, never color-only", () => {
    render(<Lightbox images={[img("a"), img("b")]} layout="cinema" onClose={() => {}} />);
    const listbox = screen.getByRole("listbox", { name: /photo filmstrip/i });
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
  });
});

describe("Lightbox — close", () => {
  it("calls onClose when the close button is activated", () => {
    const onClose = vi.fn();
    render(<Lightbox images={[img("a")]} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Lightbox — brandVars", () => {
  it("re-applies brandVars as custom properties on the portaled root, no inference from focus", () => {
    render(
      <Lightbox
        images={[img("full", { title: "T" })]}
        layout="sidebar"
        brandVars={{ "--pf-color-bg": "#123456" }}
        onClose={() => {}}
      />
    );
    const dialog = screen.getByRole("dialog");
    expect((dialog as HTMLElement).style.getPropertyValue("--pf-color-bg")).toBe("#123456");
  });

  it("degrades to the literal var() fallbacks when brandVars is absent — no wrong-color guess", () => {
    render(<Lightbox images={[img("full", { title: "T" })]} layout="sidebar" onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect((dialog as HTMLElement).style.getPropertyValue("--pf-color-bg")).toBe("");
  });
});

describe("Lightbox — labels", () => {
  it("uses real localized strings when provided, instead of the English defaults", () => {
    render(
      <Lightbox
        images={[img("a"), img("b")]}
        labels={{ previous: "Nakaraan", next: "Susunod", counter: "{current} sa {total}", filmstrip: "Filmstrip" }}
        layout="cinema"
        onClose={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Nakaraan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Susunod" })).toBeInTheDocument();
    expect(screen.getByText("1 sa 2")).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Filmstrip" })).toBeInTheDocument();
  });
});
