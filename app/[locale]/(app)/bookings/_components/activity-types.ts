export type ActivityEntry = {
  _id: string;
  action: string;
  createdAt: string;
  diff?: {
    changes?: Record<string, { before: unknown; after: unknown }>;
  } | null;
};
