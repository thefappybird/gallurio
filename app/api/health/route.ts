import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";

// Health/readiness endpoint for an external monitor + Caddy/Cloudflare.
// Never cached — always evaluates the current process/dependency state.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), ms);
    }),
  ]);
}

// Cheap Mongo connectivity check: connect (fast path if already connected),
// confirm readyState is "connected", then a lightweight ping. Never throws —
// any failure (including timeout) resolves to false.
async function checkDb(): Promise<boolean> {
  try {
    const mongooseInstance = await withTimeout(connectDB(), DB_TIMEOUT_MS);
    if (mongooseInstance.connection.readyState !== 1) return false;
    const db = mongooseInstance.connection.db;
    if (!db) return false;
    await withTimeout(db.admin().ping(), DB_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.searchParams.get("ready") !== "1") {
    // Liveness only — process is up and serving requests.
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  const dbHealthy = await checkDb();
  const healthy = dbHealthy;

  // Non-sensitive body only: booleans, no connection strings/hostnames/errors.
  return NextResponse.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      checks: { db: dbHealthy },
    },
    { status: healthy ? 200 : 503 },
  );
}
