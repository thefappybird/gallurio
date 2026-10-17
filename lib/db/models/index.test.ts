import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import "./index";

// reindex.ts and the seed iterate mongoose.modelNames() after importing the barrel.
describe("models barrel", () => {
  it("registers the booking import job models so syncIndexes covers them", () => {
    expect(mongoose.modelNames()).toEqual(
      expect.arrayContaining(["BookingImportJob", "BookingImportJobItem"])
    );
  });
});
