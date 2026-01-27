/**
 * Conversation Thread API Route
 *
 * Get all messages in a conversation with a specific user.
 *
 * GET /api/messages/[userId] - Get conversation thread
 *
 * @example
 * GET /api/messages/user123?projectId=project456
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MessageService, MessagePermissionError } from '@/lib/services/MessageService';
import { MessageRepository } from '@/lib/repositories/MessageRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';

const componentName = 'ConversationAPI';

// Initialize repositories and service
const messageRepository = new MessageRepository(prisma);
const userRepository = new UserRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const messageService = new MessageService(
  messageRepository,
  userRepository,
  projectRepository
);

/**
 * GET /api/messages/[userId]
 *
 * Get all messages in a conversation with a specific user
 */
export async function GET(request: Request, { params }: { params: { userId: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = params;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || undefined;

    console.log(`[${componentName}] Fetching conversation:`, {
      currentUser: session.user.id,
      partnerId: userId,
      projectId,
    });

    // Use MessageService to get conversation (automatically marks as read)
    const result = await messageService.getConversation(
      session.user.id,
      userId,
      projectId
    );

    console.log(`[${componentName}] Found ${result.messages.length} messages`);

    return NextResponse.json(
      {
        messages: result.messages,
        partner: result.participant,
        total: result.messages.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error fetching conversation:`, error);

    // Map service errors to appropriate HTTP status codes
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
        error: 'Failed to fetch conversation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
