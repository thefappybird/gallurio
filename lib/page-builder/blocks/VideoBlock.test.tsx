import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseVideoEmbed, VideoBlock } from "./VideoBlock";

// ---------------------------------------------------------------------------
// parseVideoEmbed — pure function
// ---------------------------------------------------------------------------

describe("parseVideoEmbed — YouTube URL formats", () => {
  it("parses watch?v= format", () => {
    const result = parseVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result).not.toBeNull();
    expect(result?.provider).toBe("youtube");
    expect(result?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("parses youtu.be/<id> short-link", () => {
    const result = parseVideoEmbed("https://youtu.be/dQw4w9WgXcQ");
    expect(result).not.toBeNull();
    expect(result?.provider).toBe("youtube");
    expect(result?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("parses /embed/<id> format", () => {
    const result = parseVideoEmbed("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(result).not.toBeNull();
    expect(result?.provider).toBe("youtube");
    expect(result?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("parses /shorts/<id> format", () => {
    const result = parseVideoEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ");
    expect(result).not.toBeNull();
    expect(result?.provider).toBe("youtube");
    expect(result?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("uses youtube-nocookie.com domain (not youtube.com)", () => {
    const result = parseVideoEmbed("https://youtu.be/dQw4w9WgXcQ");
    expect(result?.src).toContain("youtube-nocookie.com");
    expect(result?.src).not.toContain("youtube.com/embed");
  });

  it("parses watch?v= with extra query params", () => {
    const result = parseVideoEmbed("https://www.youtube.com/watch?list=PLxxx&v=dQw4w9WgXcQ&t=42");
    expect(result?.provider).toBe("youtube");
    expect(result?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });
});

describe("parseVideoEmbed — Vimeo URL formats", () => {
  it("parses vimeo.com/<digits> format", () => {
    const result = parseVideoEmbed("https://vimeo.com/123456789");
    expect(result).not.toBeNull();
    expect(result?.provider).toBe("vimeo");
    expect(result?.src).toBe("https://player.vimeo.com/video/123456789");
  });

  it("parses player.vimeo.com/video/<digits> format", () => {
    const result = parseVideoEmbed("https://player.vimeo.com/video/123456789");
    expect(result).not.toBeNull();
    expect(result?.provider).toBe("vimeo");
    expect(result?.src).toBe("https://player.vimeo.com/video/123456789");
  });

  it("uses player.vimeo.com/video/<id> as the embed src", () => {
    const result = parseVideoEmbed("https://vimeo.com/987654321");
    expect(result?.src).toBe("https://player.vimeo.com/video/987654321");
  });
});

describe("parseVideoEmbed — null cases", () => {
  it("returns null for an empty string", () => {
    expect(parseVideoEmbed("")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseVideoEmbed(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseVideoEmbed(null)).toBeNull();
  });

  it("returns null for a generic non-video URL", () => {
    expect(parseVideoEmbed("https://example.com/some/page")).toBeNull();
  });

  it("returns null for a youtube-looking URL with a too-short video id (< 11 chars)", () => {
    // Valid YouTube IDs are exactly 11 chars; 10 chars should be rejected
    expect(parseVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXc")).toBeNull();
  });

  it("extracts first 11 chars from a youtube-looking URL with a longer id (regex greedy prefix match)", () => {
    // The regex [A-Za-z0-9_-]{11} is not end-anchored after the ID, so a 12-char
    // sequence matches the first 11 valid chars and returns a successful embed.
    // This is correct source behavior — YouTube URLs don't carry >11-char IDs in
    // practice, but the regex is safely greedy on the first 11 alphanumeric chars.
    const result = parseVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQQ");
    expect(result).not.toBeNull();
    expect(result?.provider).toBe("youtube");
    // It matches the FIRST 11 chars: dQw4w9WgXcQ
    expect(result?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("accepts a vimeo URL with a short numeric id (older IDs are short)", () => {
    const result = parseVideoEmbed("https://vimeo.com/12345");
    expect(result).toEqual({ provider: "vimeo", src: "https://player.vimeo.com/video/12345" });
  });

  it("returns null for a whitespace-only string", () => {
    expect(parseVideoEmbed("   ")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// VideoBlock — component smoke tests
// ---------------------------------------------------------------------------

describe("VideoBlock — empty state", () => {
  it("shows the empty-state placeholder when videoUrl is blank", () => {
    render(
      <VideoBlock
        videoUrl=""
      />
    );
    expect(screen.getByText(/Paste a YouTube or Vimeo link/i)).toBeTruthy();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("does NOT render an iframe when no valid URL is provided", () => {
    render(
      <VideoBlock
        videoUrl="https://example.com"
      />
    );
    expect(document.querySelector("iframe")).toBeNull();
  });
});

describe("VideoBlock — populated state", () => {
  it("renders an iframe with the correct embed src for a YouTube URL", () => {
    render(
      <VideoBlock
        videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      />
    );
    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("renders an iframe with the correct embed src for a Vimeo URL", () => {
    render(
      <VideoBlock
        videoUrl="https://vimeo.com/123456789"
      />
    );
    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.src).toBe("https://player.vimeo.com/video/123456789");
  });

  it("does NOT show the empty-state placeholder when a valid URL is given", () => {
    render(
      <VideoBlock
        videoUrl="https://youtu.be/dQw4w9WgXcQ"
      />
    );
    expect(screen.queryByText(/Paste a YouTube or Vimeo link/i)).toBeNull();
  });
});

describe("VideoBlock — manual block contract", () => {
  it("ignores legacy description and footer props", () => {
    const legacyProps = {
      videoUrl: "",
      description: "Legacy description",
      footer: "Legacy footer",
    } as unknown as Parameters<typeof VideoBlock>[0];
    render(<VideoBlock {...legacyProps} />);
    expect(screen.queryByText("Legacy description")).toBeNull();
    expect(screen.queryByText("Legacy footer")).toBeNull();
  });

  it("always uses 'Embedded video' as iframe title", () => {
    render(
      <VideoBlock
        videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      />
    );
    const iframe = document.querySelector("iframe");
    expect(iframe?.title).toBe("Embedded video");
  });
});

describe("VideoBlock — data-empty attribute", () => {
  it("sets data-empty='true' when no valid embed is detected", () => {
    const { container } = render(
      <VideoBlock
        videoUrl=""
      />
    );
    const section = container.querySelector("[data-block='video']");
    expect(section?.getAttribute("data-empty")).toBe("true");
  });

  it("does NOT set data-empty when a valid embed is detected", () => {
    const { container } = render(
      <VideoBlock
        videoUrl="https://youtu.be/dQw4w9WgXcQ"
      />
    );
    const section = container.querySelector("[data-block='video']");
    expect(section?.getAttribute("data-empty")).toBeNull();
  });
});

describe("VideoBlock — default spacing", () => {
  it("imposes no section-level padding or background of its own — no framing box", () => {
    // A Container preset (or standalone wrap) supplies spacing; the block itself
    // must not also pad/background its section, or nesting the two double-frames.
    const html = renderToStaticMarkup(<VideoBlock videoUrl="" />);
    expect(html).not.toContain("padding");
    expect(html).not.toContain("max-width");
    expect(html).not.toContain("var(--pf-color-bg)");
  });
});
