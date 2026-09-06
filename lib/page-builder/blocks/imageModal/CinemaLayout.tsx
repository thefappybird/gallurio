"use client";

import { ImmersiveViewer } from "../ImmersiveViewer";
import type { ImageModalLeafProps } from "../Lightbox";

/**
 * Cinema is the image-modal entry point for the same visual treatment used by
 * Featured Work's Immersive popup. The Lightbox shell owns index and paging
 * state; ImmersiveViewer keeps the rendered image, metadata card, navigation,
 * dots, and filmstrip identical between the two surfaces.
 */
export function CinemaLayout({
  image,
  images,
  index,
  total,
  canGoPrev,
  canGoNext,
  isPendingMore,
  onPrev,
  onNext,
  onSelect,
  fullSizeAlt,
  prevLabel,
  nextLabel,
  filmstripLabel,
  metadataLabels,
  dotLabelTemplate,
}: ImageModalLeafProps) {
  return (
    <ImmersiveViewer
      image={image}
      images={images}
      index={index}
      canGoPrev={canGoPrev}
      canGoNext={canGoNext}
      isPendingNext={isPendingMore}
      onPrev={onPrev}
      onNext={onNext}
      onSelect={onSelect}
      previousLabel={prevLabel}
      nextLabel={nextLabel}
      filmstripLabel={filmstripLabel}
      dotLabelTemplate={dotLabelTemplate}
      showDots={total <= images.length && images.length <= 8}
      imageFallbackLabel={fullSizeAlt}
      metadataLabels={metadataLabels}
    />
  );
}
