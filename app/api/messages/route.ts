/**
 * Messages API Route
 *
 * Handles message operations for buyer-seller communication.
 *
 * GET /api/messages - List user's conversations
 * POST /api/messages - Send a new message
 *
 * @example
 * GET /api/messages?userId=user123
 * POST /api/messages { recipientId, projectId, content }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { withApiRateLimit } from '@/lib/middleware/withRateLimit';
import {
  MessageService,
  MessageValidationError,
  MessagePermissionError,
} from '@/lib/services/MessageService';
import { MessageRepository } from '@/lib/repositories/MessageRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { emailService } from '@/lib/services';
import { z } from 'zod';

const componentName = 'MessagesAPI';

// Initialize repositories and service
const messageRepository = new MessageRepository(prisma);
const userRepository = new UserRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const messageService = new MessageService(
  messageRepository,
  userRepository,
  projectRepository,
  emailService as any
);

const sendMessageSchema = z.object({
  recipientId: z.string(),
  projectId: z.string().optional(),
  transactionId: z.string().optional(),
  content: z.string().min(1).max(5000),
});

/**
 * GET /api/messages (internal handler)
 *
 * List user's conversations with message preview
 */
async function getConversations(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || undefined;

    console.log(`[${componentName}] Fetching conversations for user:`, session.user.id);

    // Use MessageService to get conversations
    const conversations = await messageService.getConversations(
      session.user.id,
      projectId
    );

    console.log(`[${componentName}] Found ${conversations.length} conversations`);

    return NextResponse.json(
      {
        conversations,
        total: conversations.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error fetching conversations:`, error);

    return NextResponse.json(
      {
        error: 'Failed to fetch conversations',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages (internal handler)
 *
 * Send a new message
 */
async function sendMessage(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = sendMessageSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validatedData.error.errors,
        },
        { status: 400 }
      );
    }

    const { recipientId, projectId, transactionId, content } = validatedData.data;

    console.log(`[${componentName}] Sending message:`, {
      senderId: session.user.id,
      recipientId,
      projectId,
    });

    // Build request object conditionally to handle exactOptionalPropertyTypes
    const requestData: {
      recipientId: string;
      content: string;
      projectId?: string;
      transactionId?: string;
    } = {
      recipientId,
      content,
    };

    if (projectId) requestData.projectId = projectId;
    if (transactionId) requestData.transactionId = transactionId;

    // Use MessageService to send message
    const message = await messageService.sendMessage(session.user.id, requestData);

    console.log(`[${componentName}] Message sent:`, message.id);

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error(`[${componentName}] Error sending message:`, error);

    // Map service errors to appropriate HTTP status codes
    if (error instanceof MessageValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          field: error.field,
        },
        { status: 400 }
      );
    }

    if (error instanceof MessagePermissionError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to send message',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Export rate-limited handlers
 *
 * GET: API rate limiting (100 requests / minute per user)
 * POST: API rate limiting (100 requests / minute per user)
 */
export const GET = withApiRateLimit(getConversations, async (request) => {
  const session = await auth();
  return session?.user?.id || 'anonymous';
});

export const POST = withApiRateLimit(sendMessage, async (request) => {
  const session = await auth();
  return session?.user?.id || 'anonymous';
});
