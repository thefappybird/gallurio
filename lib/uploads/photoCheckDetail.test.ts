import { describe, expect, it } from "vitest";
import { photoCheckDetail } from "./photoCheckDetail";

describe("photoCheckDetail", () => {
  it("builds format_not_accepted detail with the rejected format and accepted list", () => {
    const detail = photoCheckDetail("format_not_accepted", { format: "gif" }, 15 * 1024 * 1024);
    expect(detail.code).toBe("format_not_accepted");
    expect(detail.format).toBe("gif");
    expect(detail.acceptedTypes).toEqual(expect.arrayContaining(["jpg", "png", "webp", "avif"]));
  });

  it("builds file_too_large detail with actual and max bytes", () => {
    const detail = photoCheckDetail(
      "file_too_large",
      { sizeBytes: 20 * 1024 * 1024 },
      15 * 1024 * 1024,
    );
    expect(detail).toEqual({ code: "file_too_large", actualBytes: 20 * 1024 * 1024, maxBytes: 15 * 1024 * 1024 });
  });

  it("builds dimension_too_small detail with actual width/height and the minimum short side", () => {
    const detail = photoCheckDetail(
      "dimension_too_small",
      { width: 400, height: 800 },
      15 * 1024 * 1024,
    );
    expect(detail).toEqual({ code: "dimension_too_small", actualWidth: 400, actualHeight: 800, minShortSide: 600 });
  });
});
