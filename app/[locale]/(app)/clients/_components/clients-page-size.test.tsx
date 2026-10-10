import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ClientsPageClient } from "./clients-page-client";

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/clients",
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/use-data-events", () => ({ useInvalidateFor: () => vi.fn() }));
vi.mock("@/lib/actions/clients", () => ({ reactivateClientAction: vi.fn() }));
vi.mock("@/components/app/page-size-select", () => ({
  PageSizeSelect: ({ options }: { options?: number[] }) => (
    <div data-testid="page-size-options">{options?.join(",")}</div>
  ),
}));

describe("ClientsPageClient page size", () => {
  it("passes the server-resolved page-size options to the selector", () => {
    renderWithProviders(
      <ClientsPageClient
        rows={[]}
        total={5}
        page={1}
        limit={12}
        pageSizeOptions={[12, 20, 30, 50]}
        locale="en"
        availableTags={[]}
        empty="none"
        listEmpty="none"
        listEmptyHint=""
      />
    );
    expect(screen.getByTestId("page-size-options")).toHaveTextContent("12,20,30,50");
  });
});
