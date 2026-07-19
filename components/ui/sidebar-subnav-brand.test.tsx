import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  SidebarProvider,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "./sidebar";

// Brand-forward accents: the active sub-nav item mirrors the top-level
// active state — brand teal text instead of neutral sidebar-accent-foreground.
describe("sidebar active sub-nav item", () => {
  it("uses the brand accent for the active sub-button state", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton isActive>Sub Item</SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarProvider>,
    );
    const button = container.querySelector('[data-slot="sidebar-menu-sub-button"]')!;
    expect(button).not.toBeNull();
    expect(button.hasAttribute("data-active")).toBe(true);
    expect(button.className).toContain("data-active:text-brand");
  });
});
