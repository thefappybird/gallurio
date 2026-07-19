export type ActivityEntry = {
  _id: string;
  action: string;
  createdAt: string;
  actorUserId?: string | null;
  diff?: {
    changes?: Record<string, { before: unknown; after: unknown }>;
  } | null;
};
