/**
 * Shared shape for the featured-work popup's four body layouts
 * (contact-sheet, justified, split-index — immersive is a superset, see
 * Immersive.tsx). CollectionPopup.tsx is the single data owner: it owns
 * fetching/cursor paging/state and hands each body the same read-only props,
 * so a layout swap never re-triggers a fetch or duplicates request logic.
 */

import type { LightboxImage } from "../Lightbox";
import type { CollectionPopupLabels } from "@/lib/page-builder/blockContext";

export type PopupImage = LightboxImage;

/** English-default, serialization-safe (plain strings only — no functions,
 *  since these can cross the RSC → client `puck.metadata` boundary). Superset
 *  of `CollectionPopupLabels` — CollectionPopup resolves the full label set
 *  once (`applyCollectionPopupDefaults`) and hands it to every body/Immersive
 *  unchanged, so a layout swap never re-resolves labels. */
export type PopupBodyLabels = Required<CollectionPopupLabels> & {
  openPhoto: string;
  photo: string;
  loadMore: string;
  loadingMore: string;
  loadMoreFailed: string;
  photoCountOne: string;
  /** Contains the literal placeholder "{count}", swapped in by the caller. */
  photoCountOther: string;
  previousPhoto: string;
  nextPhoto: string;
  filmstripLabel: string;
};

export type PopupLayoutBodyProps = {
  images: PopupImage[];
  collectionName: string;
  /** Undefined/empty on every page saved before this feature — layouts must
   *  render their back-compat path in that case (see ContactSheet.tsx). */
  collectionDescription?: string;
  total?: number;
  hasMore: boolean;
  /** True while a "load more" page request is in flight (never true for the
   *  first page — CollectionPopup renders its own loading state for that). */
  isLoadingMore: boolean;
  loadMoreError: boolean;
  onLoadMore: () => void;
  /** Index is the position within the currently loaded `images` array. */
  onOpen: (index: number) => void;
  labels: PopupBodyLabels;
};

/** Renders "N photos" from the two singular/plural label strings above. */
export function formatPhotoCount(total: number | undefined, labels: PopupBodyLabels): string | null {
  if (typeof total !== "number") return null;
  if (total === 1) return labels.photoCountOne;
  return labels.photoCountOther.replace("{count}", String(total));
}

/**
 * `immersive` replaces CollectionPopupChrome entirely (full-viewport, no
 * shell/header/close button from the chrome), so it needs the raw fetch
 * status to render its own loading/error/empty states — unlike the other
 * three bodies, which only ever mount once CollectionPopup has already
 * resolved to "populated"/"loadingMore".
 */
export type ImmersiveStatus = "idle" | "loading" | "error" | "empty" | "populated" | "loadingMore";

export type ImmersiveProps = {
  status: ImmersiveStatus;
  images: PopupImage[];
  collectionName: string;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onClose: () => void;
  labels: PopupBodyLabels;
};
