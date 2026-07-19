import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  SidebarProvider,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "./sidebar";

// Brand-forward accents (CLAUDE.md → Design rules): the active nav item is a
// primary "catch the eye" surface, so it reads in the brand teal rather than a
// neutral grey fill.
describe("sidebar active nav item", () => {
  it("uses the brand accent for the active state", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive>Dashboard</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarProvider>,
    );
    const button = container.querySelector('[data-slot="sidebar-menu-button"]')!;
    expect(button).not.toBeNull();
    // Active attribute is set from state, and the active styling is brand-keyed.
    expect(button.hasAttribute("data-active")).toBe(true);
    expect(button.className).toContain("data-active:text-brand");
    expect(button.className).not.toContain("data-active:text-sidebar-accent-foreground");
  });
});
