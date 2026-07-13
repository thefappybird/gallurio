/**
 * Shared safety guard for one-off DB scripts (migrations, reindex, backfills).
 *
 * Never logs credentials. `parseDbTarget`/`printDbFingerprint` only ever see
 * the host + database name portion of a Mongo connection string — the
 * `user:pass@` segment and the query string (which may carry auth params)
 * are discarded before anything is returned or printed.
 */

export interface DbTarget {
  host: string;
  dbName: string;
}

const MONGO_SCHEME = /^mongodb(\+srv)?:\/\//i;

/** Parse a Mongo connection string into `{ host, dbName }`, discarding credentials and query string. */
export function parseDbTarget(uri: string): DbTarget {
  const schemeMatch = uri.match(MONGO_SCHEME);
  if (!schemeMatch) {
    throw new Error("[scriptGuard] Unrecognized DB URI scheme (expected mongodb:// or mongodb+srv://).");
  }
  const rest = uri.slice(schemeMatch[0].length);

  // Everything up to the last "@" is credentials (user:pass) — drop it.
  const atIndex = rest.lastIndexOf("@");
  const afterCreds = atIndex >= 0 ? rest.slice(atIndex + 1) : rest;

  // afterCreds = host1[,host2,...][/dbName][?query]
  const slashIndex = afterCreds.indexOf("/");
  const hostsPart = slashIndex >= 0 ? afterCreds.slice(0, slashIndex) : afterCreds;
  const pathAndQuery = slashIndex >= 0 ? afterCreds.slice(slashIndex + 1) : "";

  const host = hostsPart.split(",")[0];
  const dbNameRaw = pathAndQuery.split("?")[0];
  const dbName = dbNameRaw ? decodeURIComponent(dbNameRaw) : "(default)";

  return { host, dbName };
}

/** Log a redacted fingerprint (host + db name only — never credentials or query string). */
export function printDbFingerprint(uri: string): void {
  const { host, dbName } = parseDbTarget(uri);
  console.log(`[scriptGuard] Target -> host=${host} db=${dbName}`);
}

export interface AssertSafeTargetOptions {
  allowDev?: boolean;
  confirmProduction?: boolean;
  /** Read-only mode — downgrades both checks below to a console.warn instead of throwing. Defaults to reading `--dry-run` from argv. */
  dryRun?: boolean;
  argv?: string[];
  env?: Record<string, string | undefined>;
}

const DEV_HOST_PATTERN = /localhost|127\.0\.0\.1/i;
const DEV_DB_NAME_PATTERN = /dev|test|local/i;

/**
 * Guard against running a destructive script against the wrong target.
 *
 * Flags (consistent across every migration/reindex/backfill script):
 *   --allow-dev                  required to proceed against a dev-looking target
 *   --i-understand-production    required to proceed against anything else (production-looking)
 *   CONFIRM_PRODUCTION=1         env-var equivalent of --i-understand-production
 *   --dry-run                    read-only escape hatch — downgrades both checks to a warning
 */
export function assertSafeTarget(uri: string, opts: AssertSafeTargetOptions = {}): void {
  const target = parseDbTarget(uri);
  const argv = opts.argv ?? process.argv.slice(2);
  const env = opts.env ?? process.env;
  const dryRun = opts.dryRun ?? argv.includes("--dry-run");
  const allowDev = opts.allowDev ?? argv.includes("--allow-dev");
  const confirmProduction =
    opts.confirmProduction ??
    (argv.includes("--i-understand-production") || env.CONFIRM_PRODUCTION === "1");
  const isDev = DEV_HOST_PATTERN.test(target.host) || DEV_DB_NAME_PATTERN.test(target.dbName);

  if (isDev && !allowDev) {
    const msg = `[scriptGuard] ${dryRun ? "DRY RUN against" : "Refusing to run against"} dev-looking target (host=${target.host}, db=${target.dbName}).${dryRun ? " A live run would require --allow-dev." : " Pass --allow-dev to confirm."}`;
    if (dryRun) {
      console.warn(msg);
    } else {
      throw new Error(msg);
    }
  }

  if (!isDev && !confirmProduction) {
    const msg = `[scriptGuard] ${dryRun ? "DRY RUN against" : "Refusing to run against"} production-looking target (host=${target.host}, db=${target.dbName}) without confirmation.${dryRun ? " A live run would require --i-understand-production or CONFIRM_PRODUCTION=1." : " Pass --i-understand-production or set CONFIRM_PRODUCTION=1."}`;
    if (dryRun) {
      console.warn(msg);
    } else {
      throw new Error(msg);
    }
  }
}
