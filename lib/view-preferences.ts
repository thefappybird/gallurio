export type PersistedCollectionView = "table" | "calendar";

export const DEFAULT_PERSISTED_VIEW: PersistedCollectionView = "table";
export const COLLECTION_VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const BOOKINGS_VIEW_STORAGE_KEY = "gallurio.bookings.view";
export const INQUIRIES_VIEW_STORAGE_KEY = "gallurio.inquiries.view";

export const BOOKINGS_VIEW_COOKIE_NAME = "gallurio_bookings_view";
export const INQUIRIES_VIEW_COOKIE_NAME = "gallurio_inquiries_view";

export function isPersistedCollectionView(
  value: string | null | undefined
): value is PersistedCollectionView {
  return value === "table" || value === "calendar";
}

export function buildViewPreferenceCookie(
  name: string,
  view: PersistedCollectionView
): string {
  return [
    `${name}=${view}`,
    "Path=/",
    `Max-Age=${COLLECTION_VIEW_COOKIE_MAX_AGE}`,
    "SameSite=Lax",
  ].join("; ");
}

export function persistViewPreference(
  storageKey: string,
  cookieName: string,
  view: PersistedCollectionView
) {
  window.localStorage.setItem(storageKey, view);
  window.document.cookie = buildViewPreferenceCookie(cookieName, view);
}
