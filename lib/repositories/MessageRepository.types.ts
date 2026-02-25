import type { Message } from '@prisma/client';

/**
 * Message creation input
 */
export interface CreateMessageInput {
  senderId: string;
  recipientId: string;
  projectId?: string | null;
  transactionId?: string | null;
  content: string;
}

/**
 * Message with full relations
 */
export interface MessageWithRelations extends Message {
  sender: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  recipient: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
    email: string | null;
  };
  project?: {
    id: string;
    title: string;
    thumbnailImageUrl: string | null;
  } | null;
  transaction?: {
    id: string;
    paymentStatus: string;
  } | null;
}

/**
 * Conversation summary with latest message
 */
export interface ConversationSummary {
  partnerId: string;
  partner: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  latestMessage: {
    id: string;
    content: string;
    createdAt: Date;
    isRead: boolean;
    senderId: string;
  };
  project?: {
    id: string;
    title: string;
    thumbnailImageUrl: string | null;
  } | null;
  unreadCount: number;
}

/** Shared Prisma include for full message relations */
export const MESSAGE_INCLUDE = {
  sender: {
    select: { id: true, username: true, fullName: true, avatarUrl: true },
  },
  recipient: {
    select: { id: true, username: true, fullName: true, avatarUrl: true, email: true },
  },
  project: {
    select: { id: true, title: true, thumbnailImageUrl: true },
  },
  transaction: {
    select: { id: true, paymentStatus: true },
  },
} as const;
