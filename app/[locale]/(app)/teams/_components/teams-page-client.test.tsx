import { describe, it, expect, vi, beforeEach } from "vitest";
import { type ReactNode, type ReactElement, createElement } from "react";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import { TeamsPageClient } from "./teams-page-client";
import type { TeamRow } from "../_types";

// useLiveRefresh (wired into TeamsPageClient) needs a socket + a real
// next/navigation router in the tree; neither is under test here.
vi.mock("socket.io-client", () => ({
  io: () => ({ on: vi.fn(), disconnect: vi.fn() }),
}));
vi.mock("@/app/[locale]/(app)/notifications/_actions", () => ({
  markNotificationReadAction: vi.fn(),
  markAllNotificationsReadAction: vi.fn(),
}));

// Base UI's floating menu relies on layout APIs unavailable in happy-dom.
// Stub the dropdown so menu items render inline as buttons.
vi.mock("@/components/ui/dropdown-menu", () => {
  const DropdownMenu = ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "dropdown-menu" }, children);
  const DropdownMenuTrigger = ({
    render,
    children,
  }: {
    render?: ReactElement;
    children?: ReactNode;
  }) => render ?? createElement("button", null, children);
  const DropdownMenuContent = ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "dropdown-content" }, children);
  const DropdownMenuItem = ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => createElement("button", { onClick }, children);
  const DropdownMenuSeparator = () => createElement("hr");
  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
  };
});

// Capture the router so tests can assert refresh is driven by the page (not
// by the dialogs themselves — that call moved to the page's onDone callback).
const routerPush = vi.fn();
const routerRefresh = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), refresh: routerRefresh }),
  usePathname: () => "/teams",
  Link: ({ children, ...props }: React.ComponentProps<"a">) =>
    createElement("a", props, children),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

const createTeamMock = vi.fn();
vi.mock("../_actions", () => ({
  createTeamAction: (...args: unknown[]) => createTeamMock(...args),
  renameTeamAction: vi.fn(),
  setTeamColorAction: vi.fn(),
  deactivateTeamAction: vi.fn(),
  reactivateTeamAction: vi.fn(),
}));

vi.mock("../_invite-action", () => ({
  inviteMemberAction: vi.fn(),
  revokeInviteAction: vi.fn(),
}));

vi.mock("../_member-action", () => ({
  assignMemberToTeamAction: vi.fn(),
  removeMemberFromTeamAction: vi.fn(),
  removeMemberFromWorkspaceAction: vi.fn(),
  setLeadFlagAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const TEAMS: TeamRow[] = [
  { id: "t1", name: "Main", color: "#0d7377", isDefault: true, isActive: true, memberCount: 1 },
  { id: "t2", name: "Wedding crew", color: "#7c5cff", isDefault: false, isActive: true, memberCount: 3 },
];

function renderTeamsPage(props: React.ComponentProps<typeof TeamsPageClient>) {
  return renderWithProviders(
    <NotificationProvider initialNotifications={[]} initialUnreadCount={0}>
      <TeamsPageClient {...props} />
    </NotificationProvider>,
  );
}

function build(overrides: Partial<React.ComponentProps<typeof TeamsPageClient>> = {}) {
  return {
    teams: TEAMS,
    plan: "pro" as const,
    maxTeams: 5,
    maxMembersPerTeam: 10,
    members: [],
    pendingInvites: [],
    newlyAcceptedInviteCount: 0,
    ownerWorkosUserId: "user_owner",
    workspaceId: "ws1",
    canManage: true,
    ...overrides,
  };
}

describe("TeamsPageClient", () => {
  beforeEach(() => {
    routerPush.mockClear();
    routerRefresh.mockClear();
    createTeamMock.mockReset();
  });

  it("renders the table with the seeded teams", () => {
    renderTeamsPage(build());
    expect(screen.getAllByText("Main")).toHaveLength(2);
    expect(screen.getAllByText("Wedding crew")).toHaveLength(2);
  });

  it("creating a team refreshes the page after the server action succeeds", async () => {
    createTeamMock.mockResolvedValue({
      team: { id: "t3", name: "New crew", color: "#000000", isDefault: false, isActive: true, memberCount: 0 },
    });
    renderTeamsPage(build());

    fireEvent.click(screen.getByRole("button", { name: /create team/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/team name/i), {
      target: { value: "New crew" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /^create team$/i }));

    await waitFor(() => expect(createTeamMock).toHaveBeenCalledWith({ name: "New crew", color: expect.any(String) }));
    // Refresh is now owned by the page (onDone), not the dialog itself.
    await waitFor(() => expect(routerRefresh).toHaveBeenCalledTimes(1));
  });

  it("does not flash a full-table skeleton after create, since the optimistic row is already correct", async () => {
    createTeamMock.mockResolvedValue({
      team: { id: "t3", name: "New crew", color: "#000000", isDefault: false, isActive: true, memberCount: 0 },
    });
    renderTeamsPage(build());

    fireEvent.click(screen.getByRole("button", { name: /create team/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/team name/i), {
      target: { value: "New crew" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /^create team$/i }));

    await waitFor(() => expect(routerRefresh).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText("New crew").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Loading table data")).not.toBeInTheDocument();
  });

  it("does not refresh when the create action fails", async () => {
    createTeamMock.mockResolvedValue({ error: "DUPLICATE_NAME" });
    renderTeamsPage(build());

    fireEvent.click(screen.getByRole("button", { name: /create team/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/team name/i), {
      target: { value: "Main" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /^create team$/i }));

    await waitFor(() => expect(createTeamMock).toHaveBeenCalled());
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it("hides Invite member and Create team for non-owners, but keeps View members visible", () => {
    renderTeamsPage(build({ canManage: false }));
    expect(screen.queryByRole("button", { name: /invite member/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create team/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view members/i })).toBeInTheDocument();
  });
});
