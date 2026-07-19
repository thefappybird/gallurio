import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EmailAttachment } from "./send";

export const GALLURIO_LOGO_CID = "gallurio-logo";
export const WORKSPACE_LOGO_CID = "workspace-logo";

/** Reads the bundled platform mark so development emails never depend on localhost. */
export function gallurioLogoInlineAttachment(): EmailAttachment | null {
  try {
    return {
      filename: "gallurio-logo.png",
      content: readFileSync(join(process.cwd(), "public", "brand", "gallurio-sq-white.png")).toString("base64"),
      contentId: GALLURIO_LOGO_CID,
    };
  } catch (error) {
    console.error("[email] Failed to load the inline Gallurio logo:", error);
    return null;
  }
}

/** Resend retrieves this URL once and embeds it as an inline CID attachment. */
export function workspaceLogoInlineAttachment(logoUrl: string): EmailAttachment {
  return { filename: "workspace-logo.png", path: logoUrl, contentId: WORKSPACE_LOGO_CID };
}
