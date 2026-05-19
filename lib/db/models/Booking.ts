import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const BOOKING_STATUSES = [
  "inquiry",
  "quoted",
  "booked",
  "completed",
  "cancelled",
] as const;

const bookingSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    clientName: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    eventType: { type: String, default: "other" },
    status: { type: String, enum: BOOKING_STATUSES, default: "inquiry", required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, default: null },
    location: {
      address: { type: String, default: "" },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    amount: {
      total: { type: Number, default: 0 },
      deposit: { type: Number, default: 0 },
      currency: { type: String, default: "USD" },
    },
    staffIds: { type: [Schema.Types.ObjectId], default: [] },
    notes: { type: String, default: "" },
    customFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

bookingSchema.index({ workspaceId: 1, startAt: 1 });
bookingSchema.index({ workspaceId: 1, status: 1, startAt: 1 });
bookingSchema.index({ workspaceId: 1, clientId: 1 });

export type BookingDoc = InferSchemaType<typeof bookingSchema> & { _id: mongoose.Types.ObjectId };

export const Booking: Model<BookingDoc> =
  (mongoose.models.Booking as Model<BookingDoc>) ??
  mongoose.model<BookingDoc>("Booking", bookingSchema);
