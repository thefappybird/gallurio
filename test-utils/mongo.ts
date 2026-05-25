import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

// Replica set (not single-node) so code under test can use Mongoose sessions /
// `withTransaction` — required by recordBookingForClient and any future helper
// that needs multi-document atomicity.
let mongo: MongoMemoryReplSet | null = null;

export async function startInMemoryMongo() {
  if (mongo) return;
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [
      {
        // Cold-start on Windows is slow (binary lookup + AV scan) — bump generously.
        launchTimeout: 60_000,
      },
    ],
  });
  await mongoose.connect(mongo.getUri(), { bufferCommands: false });
}

export async function stopInMemoryMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongo) {
    await mongo.stop();
    mongo = null;
  }
}

export async function clearCollections() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return;
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) {
    await c.deleteMany({});
  }
}
