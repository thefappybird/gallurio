import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { createRef } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "./turnstile-widget";

describe("TurnstileWidget — imperative reset", () => {
  const renderMock = vi.fn(() => "widget-id-1");
  const resetMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key");
    window.turnstile = {
      render: renderMock,
      reset: resetMock,
      remove: vi.fn(),
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as { turnstile?: unknown }).turnstile;
    delete (window as { onTurnstileLoad?: unknown }).onTurnstileLoad;
    renderMock.mockClear();
    resetMock.mockClear();
  });

  it("calls window.turnstile.reset with the rendered widget id", () => {
    const ref = createRef<TurnstileWidgetHandle>();
    render(<TurnstileWidget ref={ref} onToken={vi.fn()} />);

    ref.current?.reset();

    expect(resetMock).toHaveBeenCalledWith("widget-id-1");
  });
});
