export type DashboardTab = "bookings" | "portfolio";

export const DEFAULT_DASHBOARD_TAB: DashboardTab = "bookings";
export const DASHBOARD_TAB_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const DASHBOARD_TAB_STORAGE_KEY = "gallurio.dashboard.tab";
export const DASHBOARD_TAB_COOKIE_NAME = "gallurio_dashboard_tab";

export function isDashboardTab(
  value: string | null | undefined
): value is DashboardTab {
  return value === "bookings" || value === "portfolio";
}

export function buildDashboardTabCookie(tab: DashboardTab): string {
  return [
    `${DASHBOARD_TAB_COOKIE_NAME}=${tab}`,
    "Path=/",
    `Max-Age=${DASHBOARD_TAB_COOKIE_MAX_AGE}`,
    "SameSite=Lax",
  ].join("; ");
}

export function persistDashboardTab(tab: DashboardTab) {
  window.localStorage.setItem(DASHBOARD_TAB_STORAGE_KEY, tab);
  window.document.cookie = buildDashboardTabCookie(tab);
}
