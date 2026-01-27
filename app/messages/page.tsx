/**
 * Messages Page
 *
 * Shows list of all user's conversations with message previews.
 * Click on a conversation to view the full thread.
 *
 * Features:
 * - List all conversations
 * - Show unread count per conversation
 * - Display latest message preview
 * - Show associated project (if any)
 * - Real-time updates (polling)
 *
 * @example
 * /messages
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const componentName = 'MessagesPage';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  senderId: string;
}

interface Partner {
  id: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}

interface Project {
  id: string;
  title: string;
  thumbnailImageUrl: string | null;
}

interface Conversation {
  partnerId: string;
  partner: Partner;
  latestMessage: Message;
  project: Project | null;
  unreadCount: number;
}

export default function MessagesPage() {
  console.log(`[${componentName}] Page rendered`);

  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Fetch conversations
   */
  const fetchConversations = React.useCallback(async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/messages');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch conversations');
      }

      const data = await response.json();
      setConversations(data.conversations);

      console.log(`[${componentName}] Loaded ${data.conversations.length} conversations`);
    } catch (err) {
      console.error(`[${componentName}] Fetch error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch conversations');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  /**
   * Fetch conversations on mount and when session changes
   */
  React.useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchConversations();
    } else if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/messages');
    }
  }, [sessionStatus, fetchConversations, router]);

  /**
   * Poll for new messages every 30 seconds
   */
  React.useEffect(() => {
    if (sessionStatus !== 'authenticated') return;

    const interval = setInterval(() => {
      fetchConversations();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [sessionStatus, fetchConversations]);

  /**
   * Handle conversation click
   */
  const handleConversationClick = (partnerId: string, projectId?: string) => {
    const url = projectId
      ? `/messages/${partnerId}?projectId=${projectId}`
      : `/messages/${partnerId}`;
    router.push(url);
  };

  /**
   * Get initials for avatar fallback
   */
  const getInitials = (name: string | null, username: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return username.slice(0, 2).toUpperCase();
  };

  /**
   * Format timestamp
   */
  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  /**
   * Truncate message preview
   */
  const truncateMessage = (content: string, maxLength = 100) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Messages</h1>
            <p className="mt-2 text-muted-foreground">
              Communicate with buyers and sellers
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">{error}</p>
              </div>
              <Button
                onClick={() => fetchConversations()}
                variant="outline"
                className="mt-4"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && !error && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Conversations List */}
        {!isLoading && !error && conversations.length > 0 && (
          <div className="space-y-4">
            {conversations.map((conversation) => (
              <Card
                key={`${conversation.partnerId}-${conversation.project?.id || 'general'}`}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() =>
                  handleConversationClick(
                    conversation.partnerId,
                    conversation.project?.id
                  )
                }
              >
                <CardContent className="flex items-start gap-4 p-6">
                  {/* Avatar */}
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={conversation.partner.avatarUrl || undefined}
                      alt={conversation.partner.username}
                    />
                    <AvatarFallback>
                      {getInitials(
                        conversation.partner.fullName,
                        conversation.partner.username
                      )}
                    </AvatarFallback>
                  </Avatar>

                  {/* Content */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {conversation.partner.fullName || conversation.partner.username}
                        </h3>
                        {conversation.unreadCount > 0 && (
                          <Badge variant="default" className="h-5 px-2">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(conversation.latestMessage.createdAt)}
                      </span>
                    </div>

                    {/* Project Info */}
                    {conversation.project && (
                      <p className="text-sm text-muted-foreground">
                        Re: {conversation.project.title}
                      </p>
                    )}

                    {/* Message Preview */}
                    <p
                      className={`text-sm ${
                        conversation.unreadCount > 0 &&
                        conversation.latestMessage.senderId !== session?.user?.id
                          ? 'font-medium'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {conversation.latestMessage.senderId === session?.user?.id &&
                        'You: '}
                      {truncateMessage(conversation.latestMessage.content)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && conversations.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">No messages yet</h3>
              <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                Start a conversation by contacting a seller on a project page, or wait for
                buyers to reach out to you.
              </p>
              <Button onClick={() => router.push('/projects')}>Browse Projects</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
