import "server-only";
import { createHmac } from "node:crypto";

/** UTC midnight of the given instant (the rollup day bucket key, UTC variant). */
export function utcMidnight(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function saltSecret(): string {
  return (
    process.env.PAGEVIEW_SALT_SECRET ||
    process.env.ACTIVE_WORKSPACE_COOKIE_SECRET ||
    "pageview-dev-salt"
  );
}

// Salt derived from the UTC date + a server secret, so it rotates automatically
// at UTC midnight with no scheduler and nothing stored.
function dailySalt(now: Date): Buffer {
  const utcDay = now.toISOString().slice(0, 10);
  return createHmac("sha256", saltSecret()).update(`pv-salt:${utcDay}`).digest();
}

/**
 * Anonymous, daily-rotating visitor fingerprint. Raw IP/UA never leave this
 * function — only the HMAC does. Same (ip, ua) within a UTC day → same hash
 * (enables once-per-day dedup); the hash changes at UTC midnight.
 */
export function visitorHash(ip: string, ua: string, now: Date): string {
  return createHmac("sha256", dailySalt(now)).update(`${ip}|${ua}`).digest("hex");
}

const BOT_UA =
  /(bot|crawler|spider|crawl|slurp|bingpreview|facebookexternalhit|headless|monitor|preview|curl|wget|python-requests|axios|node-fetch|go-http|libwww|httpclient)/i;

/** Cheap bot/automation reject for the public beacon (UA-based, best-effort). */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 10) return true;
  return BOT_UA.test(ua);
}

// Map/$inc-safe: strip "$", turn "." into "_", lowercase, cap length. Keeps the
// `sources` keyspace bounded and free of characters Mongo treats specially.
function cleanKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\$/g, "")
    .replace(/\./g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

/**
 * Bucket a visit's traffic source: explicit utm_source wins, else the external
 * referrer host, else "direct". Returns a bounded, dotted-path-safe key.
 */
export function classifySource(
  referrer: string | null,
  utmSource: string | null,
  ownHost: string
): string {
  if (utmSource && utmSource.trim()) {
    const k = cleanKey(utmSource.trim());
    if (k) return k;
  }
  if (referrer) {
    try {
      const host = new URL(referrer).host;
      if (host && host !== ownHost) {
        const k = cleanKey(host);
        if (k) return k;
      }
    } catch {
      // not a valid URL → treat as direct
    }
  }
  return "direct";
}

export const PAGEVIEW_PAGES = ["home", "gallery", "contact"] as const;
export type PageviewPage = (typeof PAGEVIEW_PAGES)[number];
