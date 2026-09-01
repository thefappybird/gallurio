import type { MediaPickerSelection } from "./galleryPicker/MediaPicker";

type SlotItem = {
  type: string;
  props: Record<string, unknown>;
};

type GallerySlotProps = Record<string, unknown> & {
  id?: string;
  _style?: { galleryColumns?: number };
};

const GALLERY_SLOT_KEYS = ["content", "column1", "column2", "column3", "column4"] as const;

export function galleryPropsWithZones(
  props: GallerySlotProps,
  zones: Record<string, SlotItem[]> | undefined,
): GallerySlotProps {
  const id = typeof props.id === "string" ? props.id : "";
  if (!id || !zones) return props;
  let next = props;
  for (const key of GALLERY_SLOT_KEYS) {
    const zone = zones[`${id}:${key}`];
    if (!zone) continue;
    if (next === props) next = { ...props };
    next[key] = zone;
  }
  return next;
}

export function galleryZonesWithPatch(
  props: GallerySlotProps,
  patch: Record<string, unknown>,
  zones: Record<string, SlotItem[]> | undefined,
): Record<string, SlotItem[]> | null {
  const id = typeof props.id === "string" ? props.id : "";
  if (!id || !zones) return null;
  let next: Record<string, SlotItem[]> | null = null;
  for (const key of GALLERY_SLOT_KEYS) {
    const zoneKey = `${id}:${key}`;
    if (!(zoneKey in zones) || !Array.isArray(patch[key])) continue;
    if (!next) next = { ...zones };
    next[zoneKey] = patch[key] as SlotItem[];
  }
  return next;
}

function slotItems(value: unknown): SlotItem[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is SlotItem =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as SlotItem).type === "string" &&
          Boolean((item as SlotItem).props),
      )
    : [];
}

function imageItems(value: unknown): SlotItem[] {
  return slotItems(value).filter((item) => item.type === "Image");
}

function imagePublicId(item: SlotItem): string {
  const style = item.props._style;
  if (!style || typeof style !== "object") return "";
  const publicId = (style as Record<string, unknown>).bgImagePublicId;
  return typeof publicId === "string" ? publicId : "";
}

function selectionFromImage(item: SlotItem): MediaPickerSelection | null {
  const publicId = imagePublicId(item);
  if (!publicId) return null;
  const galleryItemId = item.props.galleryItemId;
  return {
    id: typeof galleryItemId === "string" && galleryItemId ? galleryItemId : publicId,
    publicId,
  };
}

function safeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80) || "photo";
}

function assignSelection(
  current: SlotItem | undefined,
  source: SlotItem | undefined,
  selection: MediaPickerSelection,
  parentId: string,
  index: number,
): SlotItem {
  const currentStyle =
    current?.props._style && typeof current.props._style === "object"
      ? (current.props._style as Record<string, unknown>)
      : {};

  return {
    type: "Image",
    props: {
      ...(current?.props ?? {}),
      id: current?.props.id ?? `${parentId}--bulk-image-${safeIdPart(selection.id)}-${index + 1}`,
      galleryItemId: selection.id,
      alt: source?.props.alt ?? "",
      _style: { ...currentStyle, bgImagePublicId: selection.publicId },
    },
  };
}

export function gallerySlotSelections(type: string, props: GallerySlotProps): MediaPickerSelection[] {
  if (type === "GalleryGrid") {
    return imageItems(props.content).map(selectionFromImage).filter((value): value is MediaPickerSelection => value !== null);
  }

  if (type !== "GalleryMasonry") return [];
  if (props.masonryLayout !== "columns") {
    return imageItems(props.content).map(selectionFromImage).filter((value): value is MediaPickerSelection => value !== null);
  }

  const columns = Math.min(4, Math.max(2, Math.floor(props._style?.galleryColumns ?? 3)));
  const lanes = Array.from({ length: columns }, (_, index) => imageItems(props[`column${index + 1}`]));
  const selections: MediaPickerSelection[] = [];
  const rows = Math.max(0, ...lanes.map((lane) => lane.length));
  for (let row = 0; row < rows; row += 1) {
    for (const lane of lanes) {
      const selection = lane[row] ? selectionFromImage(lane[row]) : null;
      if (selection) selections.push(selection);
    }
  }
  return selections;
}

export function gallerySlotPatch(
  type: string,
  props: GallerySlotProps,
  selections: MediaPickerSelection[],
): Record<string, unknown> {
  const parentId = typeof props.id === "string" && props.id ? props.id : type.toLowerCase();

  if (type === "GalleryGrid" || (type === "GalleryMasonry" && props.masonryLayout !== "columns")) {
    const current = imageItems(props.content);
    const sources = new Map(current.map((item) => [imagePublicId(item), item]));
    return {
      images: [],
      content: selections.map((selection, index) =>
        assignSelection(current[index], sources.get(selection.publicId), selection, parentId, index),
      ),
    };
  }

  if (type !== "GalleryMasonry") return {};

  const columns = Math.min(4, Math.max(2, Math.floor(props._style?.galleryColumns ?? 3)));
  const lanes = Array.from({ length: columns }, (_, index) => imageItems(props[`column${index + 1}`]));
  const visualOrder: SlotItem[] = [];
  const rows = Math.max(0, ...lanes.map((lane) => lane.length));
  for (let row = 0; row < rows; row += 1) {
    for (const lane of lanes) {
      if (lane[row]) visualOrder.push(lane[row]);
    }
  }

  const nextLanes = Array.from({ length: columns }, () => [] as SlotItem[]);
  const sources = new Map(visualOrder.map((item) => [imagePublicId(item), item]));
  selections.forEach((selection, index) => {
    nextLanes[index % columns].push(
      assignSelection(visualOrder[index], sources.get(selection.publicId), selection, parentId, index),
    );
  });

  return Object.fromEntries([
    ["images", []],
    ...nextLanes.map((lane, index) => [`column${index + 1}`, lane] as const),
  ]);
}
