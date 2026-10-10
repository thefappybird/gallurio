import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { Pagination } from "./pagination";

describe("Pagination", () => {
  it("renders the showing-label with the given values", () => {
    renderWithProviders(
      <Pagination page={1} totalPages={3} from={1} to={10} total={25} onPageChange={vi.fn()} />
    );
    expect(screen.getByText("Showing 1–10 of 25")).toBeInTheDocument();
  });

  it("disables Previous on the first page", () => {
    renderWithProviders(
      <Pagination page={1} totalPages={3} from={1} to={10} total={25} onPageChange={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("disables Next on the last page", () => {
    renderWithProviders(
      <Pagination page={3} totalPages={3} from={21} to={25} total={25} onPageChange={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("calls onPageChange with page - 1 / page + 1 when Previous/Next are clicked", () => {
    const onPageChange = vi.fn();
    renderWithProviders(
      <Pagination page={2} totalPages={3} from={11} to={20} total={25} onPageChange={onPageChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
