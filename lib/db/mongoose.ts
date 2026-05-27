import mongoose, { type Mongoose } from "mongoose";

// The env check used to run at module-load time, which broke `pnpm seed` and
// any other tsx entrypoint that loads dotenv after its imports — ES module
// hoisting evaluated this file before the .env.local was read. Now the check
// happens lazily inside connectDB() so importing mongoose models from a script
// is safe even before env vars are populated.
function getMongoUri(): string {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error("Missing DATABASE_URL environment variable");
  }
  return uri;
}

type MongooseCache = {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
};

const globalForMongoose = globalThis as unknown as {
  mongoose?: MongooseCache;
};

const cached: MongooseCache =
  globalForMongoose.mongoose ?? { conn: null, promise: null };

if (!globalForMongoose.mongoose) {
  globalForMongoose.mongoose = cached;
}

export async function connectDB(): Promise<Mongoose> {
  // Fast path: already connected (e.g. connected by a test harness or a previous call).
  if (cached.conn) return cached.conn;

  // Secondary fast path: the underlying mongoose connection is already open
  // (happens in tests that call mongoose.connect() directly via the in-memory
  // server helper without going through this cache).
  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose as unknown as Mongoose;
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(getMongoUri(), {
      bufferCommands: false,
      maxPoolSize: 10,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}
