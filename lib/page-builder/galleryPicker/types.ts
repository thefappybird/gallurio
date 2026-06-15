export type PickerCollection = {
  id: string;
  name: string;
  coverUrl: string | null;
  coverPublicId: string;
  itemCount: number;
};

export type PickerItem = {
  id: string;
  /** Asset ID (Cloudflare Images) — used by single-image fields (Hero/CTA backgrounds). */
  publicId: string;
  thumbUrl: string;
  caption: string | null;
};

export type PickerData = {
  collections: PickerCollection[];
  items: PickerItem[];
};
