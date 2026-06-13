import { WorkOS } from "@workos-inc/node";

// Singleton WorkOS client. Import from here — never construct WorkOS() inline.
const workos = new WorkOS(process.env.WORKOS_API_KEY!);

export { workos };
