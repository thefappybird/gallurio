"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCwIcon, XIcon } from "lucide-react";
import { ImmersiveViewer } from "../ImmersiveViewer";
import { formatPhotoCount, type ImmersiveProps } from "./types";

/**
 * Full-viewport Featured Work popup. This wrapper owns fetch states, keyboard
 * input, close behavior, and its local index. Its populated presentation is
 * shared with the Cinema image-modal layout through ImmersiveViewer.
 */
export function Immersive({
  status,
  images,
  collectionName,
  collectionDescription,
  total,
  hasMore,
  onLoadMore,
  onRetry,
  onClose,
  labels,
}: ImmersiveProps) {
  const [rawIndex, setIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  const index = Math.min(rawIndex, Math.max(0, images.length - 1));
  const atStart = index <= 0;
  const atEnd = index >= images.length - 1;

  const goPrev = () => {
    if (!atStart) setIndex((current) => current - 1);
  };
  const goNext = () => {
    if (!atEnd) {
      setIndex((current) => current + 1);
    } else if (hasMore) {
      onLoadMore();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  const active = images[index];

  return (
    <div
      ref={rootRef}
      // CollectionPopup's parent already provides the dialog landmark.
      data-popup-immersive=""
      aria-label={collectionName}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#0a0a0a",
        color: "#f2f2f2",
        display: "flex",
        flexDirection: "column",
        outline: "none",
        fontFamily: "var(--pf-font-body)",
      }}
    >
      <button
        type="button"
        aria-label={labels.close}
        data-popup-close=""
        onClick={onClose}
        style={{
          position: "absolute",
          top: "10px",
          insetInlineEnd: "10px",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          border: "1px solid rgba(242,242,242,0.3)",
          background: "rgba(0,0,0,0.5)",
          color: "#f2f2f2",
          cursor: "pointer",
        }}
      >
        <XIcon aria-hidden style={{ width: "16px", height: "16px" }} />
      </button>

      {status === "idle" || status === "loading" ? (
        <div
          aria-busy="true"
          aria-label={labels.loading}
          style={{
            flex: 1,
            display: "flex", flexDirection: "column", padding: "12px", gap: "10px",
          }}
        >
          <style>{`@keyframes pf-immersive-popup-pulse{50%{opacity:.45}}`}</style>
          <span className="sr-only">{labels.loading}</span>
          <div aria-hidden style={{ flex: 1, width: "100%", background: "#222", animation: "pf-immersive-popup-pulse 1.1s ease-in-out infinite" }} />
          <div aria-hidden style={{ display: "flex", width: "100%", gap: "6px" }}>{Array.from({ length: 5 }, (_, i) => <div key={i} style={{ width: "56px", height: "56px", background: "#333", animation: "pf-immersive-popup-pulse 1.1s ease-in-out infinite" }} />)}</div>
        </div>
      ) : status === "error" ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          <p style={{ margin: 0 }}>{labels.failed}</p>
          <button
            type="button"
            onClick={onRetry}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              border: "1px solid #f2f2f2",
              borderRadius: "4px",
              background: "transparent",
              color: "#f2f2f2",
              cursor: "pointer",
            }}
          >
            <RefreshCwIcon aria-hidden style={{ width: "14px", height: "14px" }} />
            {labels.retry}
          </button>
        </div>
      ) : status === "empty" ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.66,
          }}
        >
          {labels.empty}
        </div>
      ) : (
        <ImmersiveViewer
          image={active}
          images={images}
          index={index}
          canGoPrev={!atStart}
          canGoNext={!atEnd || hasMore}
          isPendingNext={status === "loadingMore" && atEnd}
          onPrev={goPrev}
          onNext={goNext}
          onSelect={setIndex}
          previousLabel={labels.previousPhoto}
          nextLabel={labels.nextPhoto}
          filmstripLabel={labels.filmstripLabel}
          dotLabelTemplate={labels.photoOf}
          showDots={!hasMore && images.length <= 8}
          imageFallbackLabel={labels.fullSizeAlt}
          metadataLabels={{
            date: labels.dateLabel,
            location: labels.locationLabel,
            client: labels.clientLabel,
            tags: labels.tagsLabel,
          }}
          collectionMetadata={{
            name: collectionName,
            description: collectionDescription,
            photoCount: formatPhotoCount(total, labels),
          }}
        />
      )}
    </div>
  );
}
