"use client";

import { useCallback, useEffect, useRef } from "react";
import type { BlockPuck } from "../blockContext";
import { usePuckStore } from "../puckHooks";
import { ImageBlock, type ImageBlockProps } from "./manualBlocks";
import type { MasonryCloneProps } from "./MasonryCloneBlock";

function MasonryCloneSelectionGuard({ id, masonryId }: { id: string; masonryId: string }) {
  const selectedItem = usePuckStore((state) => state.selectedItem);
  const dispatch = usePuckStore((state) => state.dispatch);
  const getSelectorForId = usePuckStore((state) => state.getSelectorForId);

  useEffect(() => {
    if (selectedItem?.props?.id !== id) return;
    const parentSelector = getSelectorForId(masonryId);
    if (parentSelector) dispatch({ type: "setUi", ui: { itemSelector: parentSelector } });
  }, [dispatch, getSelectorForId, id, masonryId, selectedItem]);

  return null;
}

function directLaneChild(element: HTMLElement, lane: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element;
  while (current && current.parentElement !== lane) current = current.parentElement;
  return current;
}

export function MasonryCloneClient({
  id,
  masonryId,
  gap,
  sourceId,
  imageProps,
  layoutSignature,
  puck,
}: MasonryCloneProps & { id?: string; puck?: BlockPuck }) {
  const cloneRef = useRef<HTMLDivElement>(null);
  const dragRef = puck?.dragRef;
  const setCloneRef = useCallback((element: HTMLDivElement | null) => {
    cloneRef.current = element;
    dragRef?.(element);
  }, [dragRef]);

  useEffect(() => {
    const clone = cloneRef.current;
    const column = clone?.closest<HTMLElement>("[data-masonry-column]");
    const columnsRoot = column?.parentElement;
    const lane = column?.firstElementChild as HTMLElement | null;
    if (!clone || !column || !columnsRoot || !lane) return;
    const host = directLaneChild(clone, lane);
    if (!host) return;

    let frame = 0;
    let resize: ResizeObserver | null = null;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const laneElements = Array.from(columnsRoot.querySelectorAll<HTMLElement>(":scope > [data-masonry-column]"));
        const heights = laneElements.map((laneElement) => {
          const slot = laneElement.firstElementChild as HTMLElement | null;
          if (!slot) return 0;
          const originals = Array.from(slot.children).filter((child) =>
            !(child as HTMLElement).matches("[data-masonry-clone]")
            && !(child as HTMLElement).querySelector("[data-masonry-clone]"),
          ) as HTMLElement[];
          return originals.reduce((sum, child) => sum + child.getBoundingClientRect().height, 0)
            + Math.max(0, originals.length - 1) * gap;
        });
        const ownIndex = laneElements.indexOf(column);
        const remaining = Math.max(0, Math.max(...heights) - (heights[ownIndex] ?? 0) - gap);
        host.style.setProperty("display", remaining > 1 ? "block" : "none", "important");
        host.style.setProperty("height", `${remaining}px`, "important");
        host.style.setProperty("min-height", "0px", "important");
        host.style.setProperty("max-height", `${remaining}px`, "important");
        host.style.overflow = "hidden";
        host.style.pointerEvents = "none";

        resize?.disconnect();
        laneElements.forEach((laneElement) => {
          const slot = laneElement.firstElementChild;
          if (!slot) return;
          Array.from(slot.children).forEach((child) => {
            if (!(child as HTMLElement).querySelector("[data-masonry-clone]")) resize?.observe(child);
          });
        });
      });
    };

    resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    measure();
    const ownerWindow = clone.ownerDocument.defaultView;
    ownerWindow?.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      ownerWindow?.removeEventListener("resize", measure);
      host.style.removeProperty("display");
      host.style.removeProperty("height");
      host.style.removeProperty("min-height");
      host.style.removeProperty("max-height");
      host.style.removeProperty("overflow");
      host.style.removeProperty("pointer-events");
    };
  }, [gap, layoutSignature]);

  return (
    <div
      ref={setCloneRef}
      data-masonry-clone
      data-masonry-loop-duplicate
      data-masonry-source-id={sourceId}
      aria-hidden="true"
      inert
      style={{ width: "100%", height: "100%", overflow: "hidden", pointerEvents: "none" }}
    >
      {puck?.isEditing
        ? <EditorMasonryCloneImage sourceId={sourceId} fallback={imageProps} metadata={puck.metadata} />
        : <DerivedMasonryImage imageProps={imageProps} metadata={puck?.metadata} />}
      {puck?.isEditing && id && <MasonryCloneSelectionGuard id={id} masonryId={masonryId} />}
    </div>
  );
}

function DerivedMasonryImage({
  imageProps,
  metadata,
}: {
  imageProps: Record<string, unknown>;
  metadata?: BlockPuck["metadata"];
}) {
  const sourceStyle = (imageProps._style ?? {}) as NonNullable<ImageBlockProps["_style"]>;
  const derivedImageProps = {
    ...imageProps,
    alt: "",
    _style: { ...sourceStyle, height: "100%", minHeight: undefined },
  } as ImageBlockProps;
  return <ImageBlock {...derivedImageProps} puck={{ metadata }} />;
}

function EditorMasonryCloneImage({
  sourceId,
  fallback,
  metadata,
}: {
  sourceId: string;
  fallback: Record<string, unknown>;
  metadata?: BlockPuck["metadata"];
}) {
  const sourceProps = usePuckStore((state) => {
    if (!sourceId) return undefined;
    // Puck's getItemById dereferences its index without an absence guard. A
    // source can be briefly absent during a reorder, so keep rendering the
    // reconciled snapshot until the live item is indexed again.
    try {
      return state.getItemById(sourceId)?.props as Record<string, unknown> | undefined;
    } catch {
      return undefined;
    }
  });
  const fallbackStyle = (fallback._style ?? {}) as Record<string, unknown>;
  const liveStyle = (sourceProps?._style ?? {}) as Record<string, unknown>;
  const effectiveProps = sourceProps
    ? { ...fallback, ...sourceProps, _style: { ...fallbackStyle, ...liveStyle } }
    : fallback;
  return <DerivedMasonryImage imageProps={effectiveProps} metadata={metadata} />;
}
