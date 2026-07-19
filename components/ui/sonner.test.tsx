import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));

// Capture the props our wrapper passes down to sonner's Toaster.
let captured: Record<string, unknown> = {};
vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => {
    captured = props;
    return null;
  },
}));

// Imported after the mock so the wrapper picks up the mocked sonner.
const { Toaster } = await import("./sonner");

function renderAt(locale: string) {
  captured = {};
  return render(
    <NextIntlClientProvider locale={locale} messages={enMessages}>
      <Toaster />
    </NextIntlClientProvider>,
  );
}

describe("Toaster RTL", () => {
  it("anchors bottom-left and sets dir=rtl in Arabic", () => {
    renderAt("ar");
    expect(captured.position).toBe("bottom-left");
    expect(captured.dir).toBe("rtl");
  });
});
