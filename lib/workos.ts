import { WorkOS } from "@workos-inc/node";
import { env } from "@/lib/env";

// Singleton WorkOS client. Import from here — never construct WorkOS() inline.
const workos = new WorkOS(env.WORKOS_API_KEY!);

export { workos };
