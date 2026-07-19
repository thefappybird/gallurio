import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { UsersIcon } from "lucide-react";
import { renderWithProviders } from "@/test-utils/render";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the heading and description", () => {
    renderWithProviders(
      <EmptyState icon={UsersIcon} title="No clients yet" description="Add your first one." />
    );
    expect(screen.getByText("No clients yet")).toBeInTheDocument();
    expect(screen.getByText("Add your first one.")).toBeInTheDocument();
  });

  it("renders a keyboard-reachable action button and fires it", () => {
    const onClick = vi.fn();
    renderWithProviders(
      <EmptyState
        icon={UsersIcon}
        title="No clients yet"
        action={<Button onClick={onClick}>Add client</Button>}
      />
    );
    const button = screen.getByRole("button", { name: "Add client" });
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("omits the action wrapper when no action is given", () => {
    renderWithProviders(<EmptyState icon={UsersIcon} title="No clients yet" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
