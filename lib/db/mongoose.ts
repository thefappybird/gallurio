import mongoose, { type Mongoose } from "mongoose";

const MONGODB_URI = process.env.DATABASE_URL;

if (!MONGODB_URI) {
  throw new Error("Missing DATABASE_URL environment variable");
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
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI!, {
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
