import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CinemaLayout } from "./CinemaLayout";
import type { ImageModalLeafProps, LightboxImage } from "../Lightbox";

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

function baseProps(overrides: Partial<ImageModalLeafProps> = {}): ImageModalLeafProps {
  const image = overrides.image ?? img("a");
  const images = overrides.images ?? [image];
  return {
    image,
    images,
    index: 0,
    total: images.length,
    hasNav: images.length > 1,
    canGoPrev: false,
    canGoNext: false,
    isPendingMore: false,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onSelect: vi.fn(),
    onClose: vi.fn(),
    closeLabel: "Close",
    fullSizeAlt: "Full size photo",
    prevLabel: "Previous image",
    nextLabel: "Next image",
    counterText: "1 / 1",
    filmstripLabel: "Photo filmstrip",
    seeMoreLabel: "See more",
    seeLessLabel: "See less",
    additionalInformationLabel: "Additional information",
    dotLabelTemplate: "Photo {current} of {total}",
    ...overrides,
  };
}

describe("CinemaLayout - shared Immersive design", () => {
  it("renders the shared immersive viewer instead of the former cinema chrome", () => {
    const image = img("a", { title: "Golden hour" });
    render(<CinemaLayout {...baseProps({ image })} />);

    expect(document.querySelector("[data-immersive-viewer]")).toBeInTheDocument();
    expect(document.querySelector("[data-immersive-main]")).toBeInTheDocument();
    expect(document.querySelector("[data-immersive-collection-card]")).not.toBeInTheDocument();
    expect(document.querySelector(".pf-modal-cinema-chrome")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "See more" })).not.toBeInTheDocument();
  });

  it("shows every photo detail in one compact, far-left metadata card", () => {
    const image = img("a", {
      title: "Golden hour",
      caption: "A couple walking at sunset",
      date: "2026-09-06",
      location: "Manila",
      client: "Cruz Wedding",
      meta: [
        { label: "Camera", value: "GFX100" },
        { label: "Lens", value: "80mm" },
      ],
      tags: ["wedding", "outdoor"],
    });
    render(<CinemaLayout {...baseProps({ image })} />);

    const card = document.querySelector("[data-immersive-meta-card]") as HTMLElement;
    expect(card).toBeInTheDocument();
    expect(card.style.position).toBe("absolute");
    expect(card.style.insetInlineStart).toBe("16px");
    expect(card.style.flexDirection).toBe("column");

    const cardQueries = within(card);
    expect(cardQueries.getByText("Golden hour")).toBeInTheDocument();
    expect(cardQueries.getByText("A couple walking at sunset")).toBeInTheDocument();
    expect(cardQueries.getByText("2026-09-06")).toBeInTheDocument();
    expect(cardQueries.getByText("Manila")).toBeInTheDocument();
    expect(cardQueries.getByText("Cruz Wedding")).toBeInTheDocument();
    expect(cardQueries.getByText("GFX100")).toBeInTheDocument();
    expect(cardQueries.getByText("80mm")).toBeInTheDocument();
    expect(cardQueries.getByText("wedding, outdoor")).toBeInTheDocument();
    expect(card.querySelectorAll('[data-immersive-meta-row="fact"]')).toHaveLength(5);
  });

  it("does not render an empty metadata card", () => {
    render(<CinemaLayout {...baseProps()} />);
    expect(document.querySelector("[data-immersive-meta-card]")).not.toBeInTheDocument();
  });

  it("uses portfolio theme fonts for the viewer and metadata title", () => {
    const image = img("a", { title: "Golden hour" });
    render(<CinemaLayout {...baseProps({ image })} />);

    const viewer = document.querySelector("[data-immersive-viewer]") as HTMLElement;
    expect(viewer.style.fontFamily).toBe("var(--pf-font-body)");
    expect(screen.getByRole("heading", { name: "Golden hour" }).style.fontFamily).toBe(
      "var(--pf-font-heading)",
    );
  });

  it("uses immersive side arrows and forwards navigation", () => {
    const images = [img("a"), img("b")];
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <CinemaLayout
        {...baseProps({
          image: images[1],
          images,
          index: 1,
          canGoPrev: true,
          canGoNext: true,
          onPrev,
          onNext,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous image" }));
    fireEvent.click(screen.getByRole("button", { name: "Next image" }));
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("marks the next immersive arrow busy while another page is loading", () => {
    const images = [img("a"), img("b")];
    render(
      <CinemaLayout
        {...baseProps({
          image: images[1],
          images,
          index: 1,
          canGoNext: true,
          isPendingMore: true,
        })}
      />,
    );
    expect(screen.getByRole("button", { name: "Next image" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});

describe("CinemaLayout - immersive pagination and filmstrip", () => {
  it("renders immersive dots and square filmstrip frames for a fully loaded small set", () => {
    const images = [img("a"), img("b"), img("c")];
    const onSelect = vi.fn();
    render(
      <CinemaLayout
        {...baseProps({ image: images[0], images, total: 3, hasNav: true, onSelect })}
      />,
    );

    expect(document.querySelector("[data-immersive-dots]")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Photo 1 of 3" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0].style.width).toBe("56px");
    expect(options[0].style.height).toBe("56px");
    fireEvent.click(options[2]);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("omits dots when the total is larger than the loaded set or exceeds eight", () => {
    const images = [img("a"), img("b"), img("c")];
    const { rerender } = render(
      <CinemaLayout {...baseProps({ image: images[0], images, total: 5 })} />,
    );
    expect(document.querySelector("[data-immersive-dots]")).not.toBeInTheDocument();

    const manyImages = Array.from({ length: 9 }, (_, index) => img(`p${index}`));
    rerender(
      <CinemaLayout
        {...baseProps({ image: manyImages[0], images: manyImages, total: manyImages.length })}
      />,
    );
    expect(document.querySelector("[data-immersive-dots]")).not.toBeInTheDocument();
    expect(screen.queryByText("1 / 9")).not.toBeInTheDocument();
  });
});
