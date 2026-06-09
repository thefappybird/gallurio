/**
 * GalleryCarouselBlock — ISOMORPHIC (client-safe). Maps its own `images[]` prop to
 * CarouselSlide[] and feeds the existing GalleryCarouselClient island. No DB, no
 * server context, no server-only Cloudinary import. Floating header copy renders
 * via the shared GalleryHeader; empty/chrome labels come from puck.metadata chrome
 * (pure, client-safe) with English fallbacks.
 */

import type { ComponentConfig, Field, Fields } from "@measured/puck";
import { cloudinaryImageUrl } from "@/lib/page-builder/cloudinaryClient";
import { getGalleryChromeLabelsFrom, type BlockPuck } from "@/lib/page-builder/blockContext";
import { GalleryCarouselClient, type CarouselSlide } from "./GalleryCarouselClient";
import {
  resolveBlockStyle,
  resolveBlockAttrs,
  productionStyleField,
  type BlockStyle,
} from "@/lib/page-builder/styleToolkit";
import { GalleryHeader } from "./GalleryText";
import type { GalleryImage } from "./GalleryGridBlock";

export type CarouselFloatX = "left" | "center" | "right";
export type CarouselFloatY = "top" | "center" | "bottom";

export type GalleryCarouselProps = {
  _style?: BlockStyle;
  images: GalleryImage[];
  heading: string;
  description: string;
  aspect: "square" | "landscape" | "portrait";
  floatX: CarouselFloatX;
  floatY: CarouselFloatY;
  autoplay: boolean;
};

export const galleryCarouselDefaultProps: GalleryCarouselProps = {
  images: [],
  heading: "",
  description: "",
  aspect: "landscape",
  floatX: "center",
  floatY: "center",
  autoplay: false,
};

const FLOAT_X_TO_JUSTIFY: Record<CarouselFloatX, string> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

const FLOAT_Y_TO_ALIGN: Record<CarouselFloatY, string> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
};

const THUMB_SIZE: Record<GalleryCarouselProps["aspect"], { width: number; height: number }> = {
  square: { width: 800, height: 800 },
  landscape: { width: 1000, height: 562 },
  portrait: { width: 700, height: 933 },
};

export function GalleryCarouselBlock({
  _style,
  images,
  heading,
  description,
  aspect,
  floatX,
  floatY,
  autoplay,
  puck,
}: GalleryCarouselProps & { puck?: BlockPuck }) {
  const labels = getGalleryChromeLabelsFrom(puck);
  const list = Array.isArray(images) ? images : [];

  if (list.length === 0) {
    return <CarouselEmptyState message={labels.empty} />;
  }

  const horizontal: CarouselFloatX = floatX ?? "center";
  const vertical: CarouselFloatY = floatY ?? "center";
  const size = THUMB_SIZE[aspect] ?? THUMB_SIZE.landscape;

  const slides: CarouselSlide[] = list
    .map((img) => ({
      id: img.id,
      src: cloudinaryImageUrl(img.publicId, { width: size.width, height: size.height, crop: "fill" }),
      alt: img.alt ?? "",
    }))
    .filter((s) => s.src);

  return (
    <section
      data-block="gallery-carousel"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: "0.75rem",
        fontFamily: "var(--pf-font-body)",
        ...resolveBlockStyle(_style),
      }}
      {...resolveBlockAttrs(_style)}
    >
      <div style={{ position: "relative", maxWidth: "80rem", margin: "0 auto" }}>
        <GalleryCarouselClient
          slides={slides}
          aspect={aspect}
          autoplay={autoplay}
          labels={{ hint: labels.carouselHint, prev: labels.carouselPrev, next: labels.carouselNext }}
        />
        <div
          data-gallery-overlay="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: FLOAT_Y_TO_ALIGN[vertical],
            justifyContent: FLOAT_X_TO_JUSTIFY[horizontal],
            // Text Padding (toolkit) drives the overlay inset; default keeps the prior 1.5rem.
            padding: `${_style?.textPaddingY ?? "1.5rem"} ${_style?.textPaddingX ?? "1.5rem"}`,
            pointerEvents: "none",
          }}
        >
          <div style={{ width: "min(100%, 40rem)" }}>
            <GalleryHeader
              heading={heading}
              description={description}
              align={_style?.align ?? horizontal}
              overlay
              textColorToken={_style?.textColorToken}
              bold={_style?.bold}
              italic={_style?.italic}
              underline={_style?.underline}
              headingHighlight={_style?.headingHighlight}
              headingHighlightToken={_style?.headingHighlightToken}
              descriptionHighlight={_style?.descriptionHighlight}
              descriptionHighlightToken={_style?.descriptionHighlightToken}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function CarouselEmptyState({ message }: { message: string }) {
  return (
    <section
      data-block="gallery-carousel"
      data-empty="true"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        padding: "4rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p
        style={{
          fontFamily: "var(--pf-font-body)",
          color: "var(--pf-color-fg)",
          opacity: 0.45,
          fontSize: "0.9375rem",
          margin: 0,
        }}
      >
        {message}
      </p>
    </section>
  );
}

export const galleryCarouselBlockConfig: ComponentConfig<GalleryCarouselProps> = {
  label: "Gallery Carousel",
  defaultProps: galleryCarouselDefaultProps,
  // `images` is intentionally absent from the sidebar fields — the editor drives
  // it via StyleToolkitField (Task 7). Production <Render> reads images straight
  // from saved props; no sidebar field is needed there either.
  fields: {
    _style: productionStyleField,
    heading: { type: "text", label: "Heading" },
    description: { type: "textarea", label: "Description" },
    aspect: {
      type: "select",
      label: "Image shape",
      options: [
        { label: "Square", value: "square" },
        { label: "Landscape", value: "landscape" },
        { label: "Portrait", value: "portrait" },
      ],
    },
    floatX: {
      type: "select",
      label: "Floating header — horizontal",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    } as Field<CarouselFloatX>,
    floatY: {
      type: "select",
      label: "Floating header — vertical",
      options: [
        { label: "Top", value: "top" },
        { label: "Middle", value: "center" },
        { label: "Bottom", value: "bottom" },
      ],
    } as Field<CarouselFloatY>,
    autoplay: {
      type: "select",
      label: "Autoplay",
      options: [
        { label: "Off", value: false },
        { label: "On", value: true },
      ],
    } as Field<boolean>,
  } as unknown as Fields<GalleryCarouselProps>,
  render: GalleryCarouselBlock,
};
