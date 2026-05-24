import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongo: MongoMemoryServer | null = null;

export async function startInMemoryMongo() {
  if (mongo) return;
  mongo = await MongoMemoryServer.create({
    // Cold-start on Windows is slow (binary lookup + AV scan) — bump generously.
    instance: { launchTimeout: 60_000 },
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
