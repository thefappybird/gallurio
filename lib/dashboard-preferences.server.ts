import { cookies } from "next/headers";
import {
  DASHBOARD_TAB_COOKIE_NAME,
  DEFAULT_DASHBOARD_TAB,
  isDashboardTab,
  type DashboardTab,
} from "./dashboard-preferences";

export async function resolveStoredDashboardTab(
  explicitTab: string | undefined
): Promise<DashboardTab> {
  if (isDashboardTab(explicitTab)) {
    return explicitTab;
  }

  const cookieStore = await cookies();
  const storedTab = cookieStore.get(DASHBOARD_TAB_COOKIE_NAME)?.value;

  return isDashboardTab(storedTab) ? storedTab : DEFAULT_DASHBOARD_TAB;
}
