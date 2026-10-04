import mongoose from "mongoose";

export type RecordedQuery = { collection: string; method: string; filter: unknown };

/**
 * Runs `fn` while recording every Mongoose collection operation (via
 * `mongoose.set("debug")`). Use to assert a loader's query budget.
 */
export async function countQueries<T>(
  fn: () => Promise<T>
): Promise<{ result: T; queries: RecordedQuery[] }> {
  const queries: RecordedQuery[] = [];
  mongoose.set("debug", (collection: string, method: string, filter: unknown) => {
    if (method === "createIndex" || method === "ensureIndex") return; // lazy autoIndex noise
    queries.push({ collection, method, filter });
  });
  try {
    const result = await fn();
    return { result, queries };
  } finally {
    mongoose.set("debug", false);
  }
}
