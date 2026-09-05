type SlotItem = {
  type: string;
  props: Record<string, unknown>;
};

type NavigationSlotProps = Record<string, unknown> & {
  id?: string;
  content?: SlotItem[];
};

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

export function navigationPropsWithZones(
  props: NavigationSlotProps,
  zones: Record<string, SlotItem[]> | undefined,
): NavigationSlotProps {
  const id = typeof props.id === "string" ? props.id : "";
  const content = id ? zones?.[`${id}:content`] : undefined;
  return content ? { ...props, content } : props;
}

export function navigationZonesWithPatch(
  props: NavigationSlotProps,
  patch: Record<string, unknown>,
  zones: Record<string, SlotItem[]> | undefined,
): Record<string, SlotItem[]> | null {
  const id = typeof props.id === "string" ? props.id : "";
  const zoneKey = id ? `${id}:content` : "";
  if (!zoneKey || !zones || !(zoneKey in zones) || !Array.isArray(patch.content)) return null;
  return { ...zones, [zoneKey]: patch.content as SlotItem[] };
}

export function navigationLogoAssetId(props: NavigationSlotProps): string {
  const image = slotItems(props.content).find((item) => item.type === "Image");
  const style = image?.props._style;
  if (!style || typeof style !== "object") return "";
  const assetId = (style as Record<string, unknown>).bgImagePublicId;
  return typeof assetId === "string" ? assetId : "";
}

export function navigationLogoPatch(
  props: NavigationSlotProps,
  assetId: string,
): { content: SlotItem[] } {
  const content = slotItems(props.content);
  const imageIndex = content.findIndex((item) => item.type === "Image");

  if (!assetId) {
    return { content: imageIndex === -1 ? content : content.filter((_, index) => index !== imageIndex) };
  }

  const current = imageIndex === -1 ? undefined : content[imageIndex];
  const currentStyle =
    current?.props._style && typeof current.props._style === "object"
      ? (current.props._style as Record<string, unknown>)
      : {};
  const hasExplicitSize = Boolean(currentStyle.width || currentStyle.height);
  const parentId = typeof props.id === "string" && props.id ? props.id : "navigation";
  const image: SlotItem = {
    type: "Image",
    props: {
      ...(current?.props ?? {}),
      id: current?.props.id ?? `${parentId}--logo-image`,
      alt: current?.props.alt ?? "Logo",
      _style: {
        ...(hasExplicitSize
          ? {}
          : {
              // Start square; owners can widen the Image block for wordmarks.
              // `contain` keeps either shape visible without cropping it.
              width: "75px",
              height: "75px",
              imageFit: "contain",
            }),
        ...currentStyle,
        bgImagePublicId: assetId,
      },
    },
  };

  return {
    content:
      imageIndex === -1
        ? [image, ...content]
        : content.map((item, index) => (index === imageIndex ? image : item)),
  };
}
