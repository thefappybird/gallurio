// Removes everything the import QA run wrote. Usage: node cleanup-import-qa.js <repoRoot> [--apply]
const path = require("path");
const repo = path.resolve(process.argv[2]);
const apply = process.argv.includes("--apply");
require(path.join(repo, "node_modules", "dotenv")).config({ path: path.join(repo, ".env.local"), quiet: true });
const mongoose = require(path.join(repo, "node_modules", "mongoose"));

(async () => {
  await mongoose.connect(process.env.DATABASE_URL);
  const db = mongoose.connection.db;
  const bookingFilter = { $or: [{ title: /^QA-IMP/ }, { clientName: /^QA / }] };
  const bookings = await db.collection("bookings").find(bookingFilter, { projection: { _id: 1, title: 1, clientId: 1, workspaceId: 1, firstSessionStart: 1, sessions: 1 } }).toArray();
  const bookingIds = bookings.map((b) => b._id);
  const clientIds = [...new Set(bookings.map((b) => String(b.clientId)))].map((id) => new mongoose.Types.ObjectId(id));
  const clients = await db.collection("clients").find({ _id: { $in: clientIds } }, { projection: { name: 1, email: 1, source: 1 } }).toArray();
  const strayClients = await db.collection("clients").find({ name: /^QA /, source: "import", _id: { $nin: clientIds } }, { projection: { name: 1 } }).toArray();
  const foreign = clients.filter((c) => !/^QA /.test(c.name ?? "") || c.source !== "import");
  const tx = await db.collection("transactions").countDocuments({ bookingId: { $in: bookingIds } });
  const logs = await db.collection("activitylogs").countDocuments({ entityId: { $in: bookingIds } });
  console.log({ bookings: bookings.length, clients: clients.length, strayClients: strayClients.length, foreignClients: foreign.map((c) => c.name), transactions: tx, activityLogs: logs });
  if (process.argv.includes("--show")) {
    for (const b of bookings) console.log(String(b._id), b.title.slice(0, 60), b.firstSessionStart?.toISOString(), (b.sessions ?? []).length);
  }
  if (apply) {
    if (foreign.length) throw new Error("refusing: a matched booking points at a non-QA client");
    const ids = [...clientIds, ...strayClients.map((c) => c._id)];
    console.log("deleted", {
      transactions: (await db.collection("transactions").deleteMany({ bookingId: { $in: bookingIds } })).deletedCount,
      activityLogs: (await db.collection("activitylogs").deleteMany({ entityId: { $in: bookingIds } })).deletedCount,
      bookings: (await db.collection("bookings").deleteMany({ _id: { $in: bookingIds } })).deletedCount,
      clientTx: (await db.collection("transactions").deleteMany({ clientId: { $in: ids } })).deletedCount,
      clients: (await db.collection("clients").deleteMany({ _id: { $in: ids }, source: "import" })).deletedCount,
    });
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
