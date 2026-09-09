"use client";

import { useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
} from "lucide-react";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import type { LightboxImage, PhotoMetadataLabels } from "./Lightbox";
import { DotPagination } from "./imageModal/DotPagination";

type ImmersiveCollectionMetadata = {
  name: string;
  description?: string;
  photoCount?: string | null;
};

const IMMERSIVE_VIEWER_STYLES = `
[data-immersive-arrow]:focus-visible,
[data-immersive-thumb]:focus-visible {
  outline: 2px solid #f2f2f2;
  outline-offset: 2px;
}
[data-immersive-thumb]:hover {
  opacity: 0.85 !important;
}
`;

type ImmersiveViewerProps = {
  image: LightboxImage | undefined;
  images: LightboxImage[];
  index: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  isPendingNext?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
  previousLabel: string;
  nextLabel: string;
  filmstripLabel: string;
  dotLabelTemplate: string;
  showDots: boolean;
  imageFallbackLabel?: string;
  metadataLabels?: PhotoMetadataLabels;
  collectionMetadata?: ImmersiveCollectionMetadata;
};

const IMMERSIVE_CARD_STYLE: React.CSSProperties = {
  position: "absolute",
  insetInlineStart: "16px",
  zIndex: 4,
  width: "max-content",
  maxWidth: "min(360px, calc(100vw - 96px))",
  maxHeight: "min(60vh, 480px)",
  overflowY: "auto",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: "7px",
  padding: "10px 12px",
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  borderRadius: "var(--pf-radius, 4px)",
  fontFamily: "var(--pf-font-body)",
};

/**
 * Shared populated-state viewer used by both Featured Work's Immersive popup
 * and the Cinema image-modal layout. Their shells own loading, closing, and
 * image-index state; this component owns the intentionally identical visual
 * treatment.
 */
export function ImmersiveViewer({
  image,
  images,
  index,
  canGoPrev,
  canGoNext,
  isPendingNext = false,
  onPrev,
  onNext,
  onSelect,
  previousLabel,
  nextLabel,
  filmstripLabel,
  dotLabelTemplate,
  showDots,
  imageFallbackLabel = "Full size photo",
  metadataLabels,
  collectionMetadata,
}: ImmersiveViewerProps) {
  const fullSrc = image
    ? imageDeliveryUrl(image.publicId, { width: 2000, fit: "scale-down" })
    : "";
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loadingImage = Boolean(fullSrc) && loadedSrc !== fullSrc;

  return (
    <div
      data-immersive-viewer=""
      style={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#0a0a0a",
        color: "#f2f2f2",
        fontFamily: "var(--pf-font-body)",
        overflow: "hidden",
      }}
    >
      <style>{`${IMMERSIVE_VIEWER_STYLES}@keyframes pf-immersive-pulse{50%{opacity:.45}}`}</style>

      <div
        data-immersive-main=""
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ImmersiveArrow
          direction="previous"
          label={previousLabel}
          disabled={!canGoPrev}
          pending={false}
          onClick={onPrev}
        />

        {image && fullSrc ? (
          <div data-modal-image-slot="" aria-busy={loadingImage || undefined} style={{ position: "relative", width: "90vw", height: "calc(100vh - 140px)" }}>
            {loadingImage && <div data-modal-image-skeleton="" aria-hidden style={{ position: "absolute", inset: 0, background: "#222", animation: "pf-immersive-pulse 1.1s ease-in-out infinite" }} />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fullSrc} alt={image.alt} onLoad={() => setLoadedSrc(fullSrc)} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", opacity: loadingImage ? 0 : 1 }} />
          </div>
        ) : (
          <div style={{ padding: "2rem", textAlign: "center" }}>
            {image?.alt || imageFallbackLabel}
          </div>
        )}

        {image ? <ImmersiveMetadataCard image={image} labels={metadataLabels} /> : null}

        {collectionMetadata ? (
          <ImmersiveCollectionMetadataCard metadata={collectionMetadata} />
        ) : null}

        <ImmersiveArrow
          direction="next"
          label={nextLabel}
          disabled={!canGoNext}
          pending={isPendingNext}
          onClick={onNext}
        />
      </div>

      {showDots ? (
        <div
          data-immersive-dots=""
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 0,
            padding: "10px 0 0",
            flexShrink: 0,
          }}
        >
          <DotPagination
            total={images.length}
            currentIndex={index}
            dotLabelTemplate={dotLabelTemplate}
            onSelect={onSelect}
          />
        </div>
      ) : null}

      <div
        role="listbox"
        aria-label={filmstripLabel}
        aria-orientation="horizontal"
        data-immersive-filmstrip=""
        style={{
          display: "flex",
          gap: "6px",
          overflowX: "auto",
          padding: "10px 12px",
          background: "#000",
          flexShrink: 0,
        }}
      >
        {images.map((frame, frameIndex) => {
          const thumbSrc = imageDeliveryUrl(frame.publicId, {
            width: 160,
            height: 160,
            fit: "cover",
          });
          const selected = frameIndex === index;

          return (
            <button
              key={frame.id}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={frame.alt || imageFallbackLabel}
              tabIndex={selected ? 0 : -1}
              data-immersive-thumb=""
              onClick={() => onSelect(frameIndex)}
              style={{
                flexShrink: 0,
                width: "56px",
                height: "56px",
                padding: 0,
                border: "none",
                outline: selected ? "2px solid #fff" : "2px solid transparent",
                outlineOffset: "-2px",
                background: "transparent",
                cursor: "pointer",
                overflow: "hidden",
                opacity: selected ? 1 : 0.6,
              }}
            >
              {thumbSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbSrc}
                  alt=""
                  aria-hidden="true"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "#333" }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ImmersiveCollectionMetadataCard({
  metadata,
}: {
  metadata: ImmersiveCollectionMetadata;
}) {
  return (
    <aside
      data-immersive-collection-card=""
      style={{
        ...IMMERSIVE_CARD_STYLE,
        top: "16px",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--pf-font-heading)",
          fontSize: "0.9375rem",
          fontWeight: 600,
          lineHeight: 1.35,
        }}
      >
        {metadata.name}
      </h2>
      {metadata.description ? (
        <p style={{ margin: 0, fontSize: "0.8125rem", lineHeight: 1.4, opacity: 0.85 }}>
          {metadata.description}
        </p>
      ) : null}
      {metadata.photoCount ? (
        <p style={{ margin: 0, fontSize: "0.75rem", lineHeight: 1.4, opacity: 0.66 }}>
          {metadata.photoCount}
        </p>
      ) : null}
    </aside>
  );
}

function ImmersiveArrow({
  direction,
  label,
  disabled,
  pending,
  onClick,
}: {
  direction: "previous" | "next";
  label: string;
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "previous" ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={pending || undefined}
      data-immersive-arrow={direction}
      onClick={onClick}
      disabled={disabled}
      style={{
        position: "absolute",
        insetInlineStart: direction === "previous" ? "16px" : undefined,
        insetInlineEnd: direction === "next" ? "16px" : undefined,
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        border: "1px solid rgba(242,242,242,0.3)",
        background: "rgba(0,0,0,0.5)",
        color: "#f2f2f2",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {pending ? (
        <Loader2Icon
          aria-hidden
          style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }}
        />
      ) : (
        <Icon aria-hidden style={{ width: "20px", height: "20px" }} />
      )}
    </button>
  );
}

export function ImmersiveMetadataCard({
  image,
  labels,
}: {
  image: LightboxImage;
  labels?: PhotoMetadataLabels;
}) {
  const resolvedLabels = labels ?? {
    date: "Date",
    location: "Location",
    client: "Client",
    tags: "Tags",
  };
  const facts = [
    image.date ? { label: resolvedLabels.date, value: image.date } : null,
    image.location ? { label: resolvedLabels.location, value: image.location } : null,
    image.client ? { label: resolvedLabels.client, value: image.client } : null,
    ...(image.meta ?? [])
      .filter((row) => row.label && row.value)
      .map((row) => ({ label: row.label, value: row.value })),
  ].filter((row): row is { label: string; value: string } => row !== null);
  const tags = image.tags?.filter(Boolean) ?? [];
  const hasMetadata = Boolean(image.title || image.caption || facts.length > 0 || tags.length > 0);

  if (!hasMetadata) return null;

  return (
    <aside
      data-immersive-meta-card=""
      style={{
        ...IMMERSIVE_CARD_STYLE,
        bottom: "16px",
      }}
    >
      {image.title ? (
        <h2
          data-immersive-meta-row="title"
          style={{
            margin: 0,
            fontFamily: "var(--pf-font-heading)",
            fontSize: "0.9375rem",
            fontWeight: 600,
            lineHeight: 1.35,
          }}
        >
          {image.title}
        </h2>
      ) : null}
      {image.caption ? (
        <p
          data-immersive-meta-row="description"
          style={{ margin: 0, fontSize: "0.8125rem", lineHeight: 1.4, opacity: 0.85 }}
        >
          {image.caption}
        </p>
      ) : null}
      {facts.length > 0 ? (
        <dl
          style={{
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            fontSize: "0.75rem",
          }}
        >
          {facts.map((fact, factIndex) => (
            <div
              key={`${fact.label}-${factIndex}`}
              data-immersive-meta-row="fact"
              style={{
                display: "grid",
                gridTemplateColumns: "auto minmax(0, 1fr)",
                alignItems: "baseline",
                gap: "10px",
              }}
            >
              <dt style={{ margin: 0, opacity: 0.66, fontWeight: 500 }}>{fact.label}</dt>
              <dd style={{ margin: 0, minWidth: 0, overflowWrap: "anywhere" }}>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {tags.length > 0 ? (
        <div
          data-immersive-meta-row="tags"
          style={{
            display: "grid",
            gridTemplateColumns: "auto minmax(0, 1fr)",
            alignItems: "baseline",
            gap: "10px",
            fontSize: "0.75rem",
          }}
        >
          <span style={{ opacity: 0.66, fontWeight: 500 }}>{resolvedLabels.tags}</span>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{tags.join(", ")}</span>
        </div>
      ) : null}
    </aside>
  );
}
