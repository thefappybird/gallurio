import "server-only";
import { env } from "@/lib/env";

if (
  !env.CLOUDFLARE_ACCOUNT_ID ||
  !env.CLOUDFLARE_IMAGES_API_TOKEN ||
  !env.CLOUDFLARE_IMAGES_ACCOUNT_HASH
) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[cloudflareImages] missing CLOUDFLARE_* env vars — uploads will fail");
  }
}

const CF_FETCH_TIMEOUT_MS = 15_000;

async function cfFetch(path: string, init?: RequestInit): Promise<Response> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const apiToken = env.CLOUDFLARE_IMAGES_API_TOKEN ?? "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CF_FETCH_TIMEOUT_MS);
  try {
    return await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`,
      {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          ...(init?.headers as Record<string, string> | undefined),
        },
      }
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`CF request timed out after ${CF_FETCH_TIMEOUT_MS}ms: ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestDirectUpload(
  workspaceId: string,
  subfolder?: string
): Promise<{ imageId: string; uploadURL: string }> {
  const form = new FormData();
  form.append("requireSignedURLs", "false");
  form.append(
    "metadata",
    JSON.stringify({ workspaceId, subfolder: subfolder ?? "gallery" })
  );

  const res = await cfFetch("/images/v2/direct_upload", { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CF direct_upload failed ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { result: { id: string; uploadURL: string } };
  return { imageId: json.result.id, uploadURL: json.result.uploadURL };
}

type CFImageRecord = {
  draft?: boolean;
  meta?: Record<string, string>;
  metadata?: Record<string, string>;
};

/**
 * Subfolder tag written for anonymous Portfolio Maker demo uploads. Real
 * gallery uploads default to "gallery", so this is what separates a demo asset
 * from a tenant's asset when both are keyed by the same metadata field.
 */
export const DEMO_UPLOAD_SUBFOLDER = "portfolio-maker-demo";

/**
 * `expectedSubfolder` narrows the check to one KIND of asset. The demo-import
 * path must pass DEMO_UPLOAD_SUBFOLDER: it compares a client-supplied id
 * against `meta.workspaceId`, and without the kind check a caller who supplies
 * a real workspace's id could adopt that workspace's assets.
 */
export async function verifyImageOwnership(
  imageId: string,
  workspaceId: string,
  expectedSubfolder?: string
): Promise<boolean> {
  // CF removes the `draft` field once upload completes (does not set it false).
  // The GET may still see draft immediately after upload — retry with backoff.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((r) => setTimeout(r, 250));
    }

    const res = await cfFetch(`/images/v1/${imageId}`);
    if (!res.ok) return false;

    const json = (await res.json()) as { result: CFImageRecord };
    const img = json.result;

    if (img.draft) continue;

    // CF may return custom metadata under `meta` or `metadata` — check both.
    const meta = img.meta ?? img.metadata ?? {};
    if (meta.workspaceId !== workspaceId) return false;
    return expectedSubfolder === undefined || meta.subfolder === expectedSubfolder;
  }

  return false;
}

/**
 * Rewrites a Cloudflare Image's custom metadata in place (asset id and URL are
 * unaffected). Used to re-parent a demo-uploaded asset onto the real workspace
 * that claims it after signup.
 */
export async function updateImageMetadata(
  imageId: string,
  metadata: Record<string, string>
): Promise<void> {
  const form = new FormData();
  form.append("metadata", JSON.stringify(metadata));

  const res = await cfFetch(`/images/v1/${imageId}`, { method: "PATCH", body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CF metadata update failed ${res.status}: ${text}`);
  }
}

export async function deleteImage(imageId: string): Promise<void> {
  if (!imageId) return;
  const res = await cfFetch(`/images/v1/${imageId}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CF delete failed ${res.status}: ${text}`);
  }
}

export function imageDeliveryUrl(
  imageId: string,
  opts: {
    width?: number;
    height?: number;
    fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
  } = {}
): string {
  const hash = env.CLOUDFLARE_IMAGES_ACCOUNT_HASH;
  if (!hash || !imageId) return "";
  if (!opts.width && !opts.height) {
    return `https://imagedelivery.net/${hash}/${imageId}/public`;
  }
  const parts: string[] = [];
  if (opts.width) parts.push(`w=${opts.width}`);
  if (opts.height) parts.push(`h=${opts.height}`);
  if (opts.fit) parts.push(`fit=${opts.fit}`);
  parts.push("q=85", "f=auto");
  return `https://imagedelivery.net/${hash}/${imageId}/${parts.join(",")}`;
}
