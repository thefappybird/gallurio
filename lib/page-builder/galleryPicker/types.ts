export type PickerCollection = {
  id: string;
  name: string;
  coverUrl: string | null;
  itemCount: number;
};

export type PickerItem = {
  id: string;
  /** Cloudinary public ID — used by single-image fields (Hero/CTA backgrounds). */
  publicId: string;
  thumbUrl: string;
  caption: string | null;
};

export type PickerData = {
  collections: PickerCollection[];
  items: PickerItem[];
};
