import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { GoogleFontLoader } from "./GoogleFontLoader";

afterEach(() => {
  cleanup();
  document.querySelectorAll("link[data-google-font]").forEach((el) => el.remove());
});

describe("GoogleFontLoader", () => {
  it("injects a stylesheet <link> for a family name", () => {
    render(<GoogleFontLoader families={["Poppins"]} />);
    const link = document.getElementById("pf-google-font-poppins") as HTMLLinkElement | null;
    expect(link).toBeTruthy();
    expect(link?.rel).toBe("stylesheet");
  });

  it("removes a previously-injected link when its family is no longer requested", () => {
    const { rerender } = render(<GoogleFontLoader families={["Foo"]} />);
    expect(document.getElementById("pf-google-font-foo")).toBeTruthy();

    rerender(<GoogleFontLoader families={["Bar"]} />);

    expect(document.getElementById("pf-google-font-foo")).toBeNull();
    expect(document.getElementById("pf-google-font-bar")).toBeTruthy();
    expect(document.querySelectorAll("link[data-google-font]").length).toBe(1);
  });
});
