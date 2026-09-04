export type PickerCollection = {
  id: string;
  name: string;
  coverUrl: string | null;
  coverPublicId: string;
  itemCount: number;
};

export type GalleryMetaRow = { label: string; value: string };

export type PickerItem = {
  id: string;
  /** Asset ID (Cloudflare Images) — used by single-image fields (Hero/CTA backgrounds). */
  publicId: string;
  thumbUrl: string;
  caption: string | null;
  /** Accessibility/SEO description of what the image shows. Distinct from `caption` (visible context) — never derive from a filename. */
  altText: string | null;
  /** Extended metadata (post-upload wizard). Absent on freshly-uploaded items until saved once. */
  title?: string | null;
  /** ISO `YYYY-MM-DD`, or "" for unset. */
  date?: string | null;
  location?: string | null;
  client?: string | null;
  tags?: string[];
  meta?: GalleryMetaRow[];
  /** Natural pixel width — populated from the upload result; absent for server-fetched items. */
  width?: number;
  /** Natural pixel height — populated from the upload result; absent for server-fetched items. */
  height?: number;
};

export type PickerData = {
  collections: PickerCollection[];
  items: PickerItem[];
};
