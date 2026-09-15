import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /favicon.ico", () => {
  it("redirects conventional favicon requests to the stable brand icon", () => {
    const response = GET(new Request("http://localhost:3000/favicon.ico"));

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("http://localhost:3000/brand/gallurio-sq-white.png");
  });
});
