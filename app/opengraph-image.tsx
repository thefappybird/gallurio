import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Gallurio — Your event business, beautifully managed.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Shared platform social card. Keep this generated rather than maintaining a
 * second hand-exported logo asset: it uses the canonical white rectangular PNG and
 * always returns the 1200x630 Open Graph dimension.
 */
export default async function OpenGraphImage() {
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
          }}
        >
          Your event business, beautifully managed.
        </div>
      </div>
    ),
    size,
  );
}
