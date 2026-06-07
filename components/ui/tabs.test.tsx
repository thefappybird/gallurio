import { describe, expect, it, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { Tabs, TabsList, TabsTab, TabsPanel } from "./tabs";

describe("Tabs", () => {
  it("renders all tabs and shows the default panel", () => {
    renderWithProviders(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTab value="a">Tab A</TabsTab>
          <TabsTab value="b">Tab B</TabsTab>
        </TabsList>
        <TabsPanel value="a">Panel A content</TabsPanel>
        <TabsPanel value="b">Panel B content</TabsPanel>
      </Tabs>
    );
    expect(screen.getByText("Tab A")).toBeInTheDocument();
    expect(screen.getByText("Tab B")).toBeInTheDocument();
    expect(screen.getByText("Panel A content")).toBeInTheDocument();
  });

  it("switches panel when a tab is clicked", () => {
    renderWithProviders(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTab value="a">A</TabsTab>
          <TabsTab value="b">B</TabsTab>
        </TabsList>
        <TabsPanel value="a">Panel A</TabsPanel>
        <TabsPanel value="b">Panel B</TabsPanel>
      </Tabs>
    );
    fireEvent.click(screen.getByText("B"));
    expect(screen.getByText("Panel B")).toBeInTheDocument();
  });

  it("does not submit a parent form when a tab is clicked", () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());

    renderWithProviders(
      <form onSubmit={onSubmit}>
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTab value="a">A</TabsTab>
            <TabsTab value="b">B</TabsTab>
          </TabsList>
          <TabsPanel value="a">Panel A</TabsPanel>
          <TabsPanel value="b">Panel B</TabsPanel>
        </Tabs>
      </form>
    );

    fireEvent.click(screen.getByRole("tab", { name: "B" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Panel B")).toBeInTheDocument();
  });
});
