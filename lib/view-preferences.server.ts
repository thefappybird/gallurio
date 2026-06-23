import { cookies } from "next/headers";
import {
  DEFAULT_PERSISTED_VIEW,
  isPersistedCollectionView,
  type PersistedCollectionView,
} from "./view-preferences";

export async function resolveStoredCollectionView(
  explicitView: string | undefined,
  cookieName: string
): Promise<PersistedCollectionView> {
  if (isPersistedCollectionView(explicitView)) {
    return explicitView;
  }

  const cookieStore = await cookies();
  const storedView = cookieStore.get(cookieName)?.value;

  return isPersistedCollectionView(storedView)
    ? storedView
    : DEFAULT_PERSISTED_VIEW;
}
