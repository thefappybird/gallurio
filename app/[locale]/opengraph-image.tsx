import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

export const alt = "Gallurio — Your event business, beautifully managed.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori's bundled default font (used when `ImageResponse` gets no explicit
// `fonts` option) only shapes Latin glyphs — Arabic and Thai render as blank
// boxes. Until Noto Sans Arabic/Thai are bundled and passed via `fonts`, those
// two locales keep the English tagline instead of broken glyphs; every other
// locale (Latin-script) renders its real translation.
const LATIN_TAGLINE_LOCALES = new Set(["en", "fil", "id"]);

type Props = { params: Promise<{ locale: string }> };

/**
 * Locale-aware social card for marketing pages (Home/Pricing/About/Contact/
 * Book-a-Demo). `/compare` and `/blog` stay on the English-only root
 * app/opengraph-image.tsx. Next resolves the NEAREST opengraph-image up the
 * route tree for each page's own segment, so a page under
 * app/[locale]/(marketing)/* picks up this file, not the root one — no
 * manual URL wiring needed in generateMetadata.
 */
export default async function OpenGraphImage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing" });
  const useLocalTagline = LATIN_TAGLINE_LOCALES.has(locale);
  const tagline = useLocalTagline
    ? `${t("hero.headlineShow")} ${t("hero.headlineRun")}`
    : "Your event business, beautifully managed.";
  const logo = await readFile(join(process.cwd(), "public", "brand", "gallurio-rect-white.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#353535",
          border: "24px solid #0d8fa1",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          padding: "72px",
          width: "100%",
        }}
      >
        {/* `next/image` cannot render inside `ImageResponse`; this is embedded
            image data used only by the generated social card. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt="Gallurio"
          height="160"
          src={logoSrc}
          style={{ objectFit: "contain", width: "640px" }}
          width="640"
        />
        <div
          style={{
            display: "flex",
            fontFamily: "Arial, sans-serif",
            fontSize: 38,
            fontWeight: 600,
            letterSpacing: "-0.5px",
            marginTop: "56px",
            textAlign: "center",
          }}
        >
          {tagline}
        </div>
      </div>
    ),
    size
  );
}
