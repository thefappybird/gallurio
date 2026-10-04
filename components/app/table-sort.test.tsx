import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { MobileSortControl } from "./table-sort";

describe("MobileSortControl", () => {
  it("toggles direction via an accessibly named button", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MobileSortControl
        table="bookings"
        options={[{ key: "title", label: "Booking" }, { key: "total", label: "Total" }]}
        sortKey="title"
        sortDir="asc"
        onSortChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Ascending" }));
    expect(onChange).toHaveBeenCalledWith("title", "desc");
  });
});
