import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { PREFERRED_CONTACT_METHODS } from "@/lib/validators/inquiry";

export const INQUIRY_STATUSES = ["new", "contacted", "converted", "archived"] as const;

// A single requested shift. Stored as wall-clock strings (not Date instants) so
// the inbox can display exactly what the visitor entered without re-deriving the
// workspace timezone. The UTC instants live on the linked draft Booking's
// sessions[]; this is the human-readable mirror.
const inquirySessionSchema = new Schema(
  {
    startDate: { type: String, required: true }, // "YYYY-MM-DD"
    startTime: { type: String, required: true }, // "HH:MM"
    endTime: { type: String, required: true }, // "HH:MM"
  },
  { _id: false }
);

const inquirySchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: null, trim: true },
    preferredContact: {
      type: String,
      enum: PREFERRED_CONTACT_METHODS,
      default: "email",
    },
    message: { type: String, default: "" },
    // Requested shifts. `eventDate` is kept as a denormalized pointer to the
    // first session's date for the existing dashboard/list sort + display paths.
    sessions: { type: [inquirySessionSchema], default: [] },
    eventDate: { type: Date, default: null },
    eventTitle: { type: String, default: "", trim: true },
    eventType: { type: String, default: "other" },
    guestCount: { type: Number, default: null },
    location: {
      label: { type: String, default: null },
      address: { type: String, default: null },
      placeId: { type: String, default: null },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    budgetRange: { type: String, default: null },
    source: {
      kind: { type: String, default: "direct" },
      utm_source: { type: String, default: null },
      utm_medium: { type: String, default: null },
      utm_campaign: { type: String, default: null },
      referrer: { type: String, default: null },
    },
    status: { type: String, enum: INQUIRY_STATUSES, default: "new", required: true },
    // Set at submission time (Phase 6): every inquiry matches-or-creates a Client
    // and an auto-created draft Booking. `converted*` fields are only set later,
    // when the owner approves the draft in the lead inbox (Phase 7).
    clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null, index: true },
    draftBookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
    convertedClientId: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    convertedBookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
  },
  { timestamps: true }
);

inquirySchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
inquirySchema.index({ workspaceId: 1, createdAt: -1 });

export type InquiryDoc = InferSchemaType<typeof inquirySchema> & {
  _id: mongoose.Types.ObjectId;
  // `timestamps: true` adds these at runtime; InferSchemaType doesn't surface
  // them, so declare them explicitly for the read paths that sort/display by date.
  createdAt: Date;
  updatedAt: Date;
};

export const Inquiry: Model<InquiryDoc> =
  (mongoose.models.Inquiry as Model<InquiryDoc>) ??
  mongoose.model<InquiryDoc>("Inquiry", inquirySchema);
