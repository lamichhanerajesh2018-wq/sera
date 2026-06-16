// lib/types.ts
// Shared shapes for Hush's MongoDB documents. _id is stored as ObjectId in the
// DB but we serialize to string before sending to client components.

export interface Community {
  _id: string;
  name: string;
  slug: string;
  description: string;
  creatorId: string;
  memberCount: number;
  createdAt: string;
  // Populated per-request for the viewer:
  isMember?: boolean;
}

export interface Post {
  _id: string;
  content: string;
  authorId: string;
  authorUsername: string;
  communityId: string;
  communitySlug: string;
  likeCount: number;
  reactions: Record<string, number>; // e.g. { "🔥": 3, "😂": 1 }
  commentCount: number;
  createdAt: string;
  // Populated per-request for the signed-in viewer (not stored):
  likedByMe?: boolean;
}

export interface Comment {
  _id: string;
  postId: string;
  content: string;
  authorId: string;
  authorUsername: string;
  parentId: string | null; // null = top-level, else replies to another comment
  createdAt: string;
}

// Reaction rows track WHO reacted, to prevent duplicates and allow toggling.
export interface Reaction {
  _id: string;
  postId: string;
  userId: string;
  type: string; // "like" or an emoji like "🔥"
}

export interface Membership {
  _id: string;
  communityId: string;
  userId: string;
  joinedAt: string;
}

// A 1-on-1 anonymous chat thread between two users.
export interface Conversation {
  _id: string;
  // The two participants' user ids (sorted, so a pair always maps to one thread).
  participantIds: string[];
  // Their handles, for display without extra lookups.
  participantUsernames: string[];
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
  // Populated per-request for the viewer:
  otherUsername?: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  createdAt: string;
}

// An anonymous question sent to a user. The sender is recorded for safety but
// is NEVER shown to the recipient — they only see the question text.
export interface AnonQuestion {
  _id: string;
  recipientId: string;
  recipientUsername: string;
  content: string;
  answer: string | null;
  answeredAt: string | null;
  // When answered, the recipient chooses whether the answer is shown on their
  // public profile wall (true) or kept private in their inbox only (false).
  isPublic: boolean;
  // Recipient's reactions to the message, e.g. { "❤️": 1, "👀": 1 }.
  reactions: Record<string, number>;
  createdAt: string;
}

// A user-submitted report about a piece of content.
export type ReportTarget = "post" | "comment" | "message" | "question";
export type ReportStatus = "open" | "reviewed" | "dismissed";

export interface Report {
  _id: string;
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  // Snapshot of the reported content + author, so moderators can act even if the
  // original is edited or removed.
  contentSnapshot: string;
  authorId: string;
  authorUsername: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
}

// An in-app notification for a user.
export type NotificationType = "question" | "reply" | "message" | "answer";

export interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  text: string;
  link: string;
  read: boolean;
  createdAt: string;
}

// A block: `blockerId` (the user who blocked) will no longer receive messages,
// questions or chats from `blockedUsername`. Stored by username because that's
// the only identity surfaced in the app; we also keep blockedId for fast checks.
export interface Block {
  _id: string;
  blockerId: string;
  blockedId: string;
  blockedUsername: string;
  createdAt: string;
}
