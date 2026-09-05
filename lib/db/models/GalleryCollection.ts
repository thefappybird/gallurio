import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const galleryCollectionSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, default: "" },
    coverItemId: { type: Schema.Types.ObjectId, ref: "GalleryItem", default: null },
    isPublic: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

galleryCollectionSchema.index({ workspaceId: 1, slug: 1 }, { unique: true });
galleryCollectionSchema.index({ workspaceId: 1, order: 1 });

export type GalleryCollectionDoc = InferSchemaType<typeof galleryCollectionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const GalleryCollection: Model<GalleryCollectionDoc> =
  (mongoose.models.GalleryCollection as Model<GalleryCollectionDoc>) ??
  mongoose.model<GalleryCollectionDoc>("GalleryCollection", galleryCollectionSchema);
