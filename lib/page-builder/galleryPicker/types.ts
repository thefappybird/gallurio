export type PickerCollection = {
  id: string;
  name: string;
  coverUrl: string | null;
  itemCount: number;
};

export type PickerItem = {
  id: string;
  thumbUrl: string;
  caption: string | null;
};

export type PickerData = {
  collections: PickerCollection[];
  items: PickerItem[];
};
