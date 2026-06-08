import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const galleryItemSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    collectionId: {
      type: Schema.Types.ObjectId,
      ref: "GalleryCollection",
      default: null,
      index: true,
    },
    cloudinaryPublicId: { type: String, required: true },
    url: { type: String, required: true },
    format: { type: String, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    sizeBytes: { type: Number, default: 0 },
    caption: { type: String, default: "" },
    altText: { type: String, default: "" },
    order: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

galleryItemSchema.index({ workspaceId: 1, collectionId: 1, order: 1 });
// Backs the "All photos" picker feed (listAllItemsPage): newest-first paginated.
galleryItemSchema.index({ workspaceId: 1, createdAt: -1 });

export type GalleryItemDoc = InferSchemaType<typeof galleryItemSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const GalleryItem: Model<GalleryItemDoc> =
  (mongoose.models.GalleryItem as Model<GalleryItemDoc>) ??
  mongoose.model<GalleryItemDoc>("GalleryItem", galleryItemSchema);
