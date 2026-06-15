import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const BOOKING_STATUSES = [
  // "draft" is the auto-created state from a public inquiry submission (Phase 6).
  // Drafts are invisible to every owner-facing booking surface (lists, calendar,
  // dashboard metrics, client history, export) until the owner approves the
  // inquiry in the lead inbox, which promotes the draft straight to "booked".
  "draft",
  "booked",
  "completed",
  "cancelled",
] as const;

const sessionSchema = new Schema(
  {
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
  },
  { _id: false }
);

const bookingSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    // The team that works this booking. Nullable only during the backfill
    // window; new bookings always carry a teamId (enforced by the create
    // validator + route). Backed by the {workspaceId, teamId, ...} compound
    // indexes below — no standalone single-field index (every query is
    // workspace-scoped). Existing bookings may reference a since-deactivated team.
    teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    clientName: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    eventType: { type: String, default: "other" },
    status: { type: String, enum: BOOKING_STATUSES, default: "booked", required: true },
    // Each booking has one or more sessions. A session is a contiguous date
    // range with a daily shift-start and shift-end time. Single-session
    // bookings behave identically to the legacy single startAt/endAt model.
    sessions: {
      type: [sessionSchema],
      required: true,
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length > 0,
        message: "At least one session is required",
      },
    },
    // Denormalized bounds — recomputed by pre-save hook whenever sessions change.
    // Kept for efficient index-based range queries without unwinding sessions.
    firstSessionStart: { type: Date, required: true },
    lastSessionEnd: { type: Date, required: true },
    location: {
      label: { type: String, default: null },
      address: { type: String, default: "" },
      placeId: { type: String, default: null },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    amount: {
      total: { type: Number, default: 0 },
      deposit: { type: Number, default: 0 },
      currency: { type: String, default: "PHP" },
    },
    staffIds: { type: [Schema.Types.ObjectId], default: [] },
    notes: { type: String, default: "" },
    customFields: { type: Schema.Types.Mixed, default: {} },
    // Back-link to the public inquiry that auto-created this draft (Phase 6).
    // Null for manually-created bookings.
    createdFromInquiryId: {
      type: Schema.Types.ObjectId,
      ref: "Inquiry",
      default: null,
    },
  },
  { timestamps: true }
);

bookingSchema.index({ workspaceId: 1, firstSessionStart: 1 });
bookingSchema.index({ workspaceId: 1, status: 1, firstSessionStart: 1 });
bookingSchema.index({ workspaceId: 1, clientId: 1 });
// Backs the lead-inbox lookup of a draft booking from its inquiry.
bookingSchema.index({ workspaceId: 1, createdFromInquiryId: 1 });
// Team-scoped calendar/list reads: members see only their teams' bookings, and
// the team picker filters by teamId. Mirrors the two workspace-scoped indexes
// above with teamId injected after workspaceId.
bookingSchema.index({ workspaceId: 1, teamId: 1, firstSessionStart: 1 });
bookingSchema.index({ workspaceId: 1, teamId: 1, status: 1, firstSessionStart: 1 });
// Backs the server-side showPast filter: excludes bookings whose lastSessionEnd
// is before today's midnight in the workspace timezone. Combined with the
// existing firstSessionStart sort this lets MongoDB satisfy the filter+sort
// via the index without a collection scan.
bookingSchema.index({ workspaceId: 1, lastSessionEnd: 1, firstSessionStart: 1 });

function recomputeDenormalized(
  sessions: { startAt: Date; endAt: Date }[]
): { firstSessionStart: Date; lastSessionEnd: Date } {
  const starts = sessions.map((s) => s.startAt.getTime());
  const ends = sessions.map((s) => s.endAt.getTime());
  return {
    firstSessionStart: new Date(Math.min(...starts)),
    lastSessionEnd: new Date(Math.max(...ends)),
  };
}

// pre("save") — fires on doc.save() and Booking.create()
bookingSchema.pre("save", function (next) {
  if (this.isModified("sessions") || this.isNew) {
    const { firstSessionStart, lastSessionEnd } = recomputeDenormalized(
      this.sessions as { startAt: Date; endAt: Date }[]
    );
    this.firstSessionStart = firstSessionStart;
    this.lastSessionEnd = lastSessionEnd;
  }
  next();
});

// pre("findOneAndUpdate") — fires on Booking.findOneAndUpdate()
bookingSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() as Record<string, unknown> | null;
  const set = (update?.$set as Record<string, unknown>) ?? {};
  const sessions = (set.sessions ?? (update as Record<string, unknown> | null)?.sessions) as
    | { startAt: Date; endAt: Date }[]
    | undefined;
  if (sessions && sessions.length > 0) {
    const { firstSessionStart, lastSessionEnd } = recomputeDenormalized(sessions);
    this.set({ firstSessionStart, lastSessionEnd });
  }
  next();
});

export type BookingDoc = InferSchemaType<typeof bookingSchema> & { _id: mongoose.Types.ObjectId };

export const Booking: Model<BookingDoc> =
  (mongoose.models.Booking as Model<BookingDoc>) ??
  mongoose.model<BookingDoc>("Booking", bookingSchema);
