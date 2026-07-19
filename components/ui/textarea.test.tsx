import { describe, expect, it } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("renders with placeholder and accepts typing", () => {
    renderWithProviders(<Textarea placeholder="Write here" />);
    const ta = screen.getByPlaceholderText("Write here") as HTMLTextAreaElement;
    expect(ta).toBeInTheDocument();
    fireEvent.change(ta, { target: { value: "hello" } });
    expect(ta.value).toBe("hello");
  });

  it("is disabled when prop set", () => {
    renderWithProviders(<Textarea disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
