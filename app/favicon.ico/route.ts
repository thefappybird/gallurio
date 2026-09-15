import { NextResponse } from "next/server";

// Browsers may request /favicon.ico even though the layouts explicitly link
// the PNG mark. Keep that conventional URL valid so navigation does not emit
// a distracting 404 and crawlers have a stable fallback icon path.
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/brand/gallurio-sq-white.png", request.url), 308);
}
