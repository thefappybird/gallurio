/**
 * React Query key factory for the gallery picker's client fetches. Every key
 * starts with `workspaceId` so an owner switching workspaces never serves
 * another tenant's cached collections/feed data from the shared QueryClient.
 */
export const galleryKeys = {
  all: (workspaceId: string) => ["gallery", workspaceId] as const,
  picker: (workspaceId: string) => [...galleryKeys.all(workspaceId), "picker"] as const,
  feed: (workspaceId: string, collectionId: string) =>
    [...galleryKeys.all(workspaceId), "feed", collectionId] as const,
  /** LayoutPreviewCard's small unpaginated preview fetch — kept distinct from
   * `feed(wsId, "all")` since it's a different limit/shape, not a page of it. */
  layoutPreview: (workspaceId: string) => [...galleryKeys.all(workspaceId), "layoutPreview"] as const,
  /** ImageBlockMetaSection's by-asset lookup for an Image block's Edit dialog. */
  itemByAsset: (workspaceId: string, assetId: string) =>
    [...galleryKeys.all(workspaceId), "itemByAsset", assetId] as const,
};
