/**
 * Conversation Thread Page
 *
 * Shows full message thread with a specific user.
 * Allows sending new messages in the conversation.
 *
 * Features:
 * - Display all messages in chronological order
 * - Send new messages
 * - Auto-scroll to bottom
 * - Mark messages as read automatically
 * - Show project context if applicable
 *
 * @example
 * /messages/user123
 * /messages/user123?projectId=project456
 */

'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, ArrowLeft, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const componentName = 'ConversationPage';

interface User {
  id: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}

interface Project {
  id: string;
  title: string;
  thumbnailImageUrl: string | null;
  priceCents: number;
  status: string;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  senderId: string;
  sender: User;
  project: Project | null;
}

function ConversationContent({ params }: { params: { userId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { data: session, status: sessionStatus } = useSession();

  const [messages, setMessages] = React.useState<Message[]>([]);
  const [partner, setPartner] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [newMessage, setNewMessage] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  /**
   * Fetch conversation messages
   */
  const fetchMessages = React.useCallback(async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const url = projectId
        ? `/api/messages/${params.userId}?projectId=${projectId}`
        : `/api/messages/${params.userId}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch messages');
      }

      const data = await response.json();
      setMessages(data.messages);
      setPartner(data.partner);

      console.log(`[${componentName}] Loaded ${data.messages.length} messages`);
    } catch (err) {
      console.error(`[${componentName}] Fetch error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, params.userId, projectId]);

  /**
   * Send new message
   */
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || isSending || !session?.user?.id) return;

    setIsSending(true);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: params.userId,
          projectId: projectId || undefined,
          content: newMessage.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const data = await response.json();
      console.log(`[${componentName}] Message sent:`, data.message.id);

      // Add new message to list
      setMessages((prev) => [...prev, data.message]);
      setNewMessage('');

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error(`[${componentName}] Send error:`, err);
      alert(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Auto-scroll to bottom on new messages
   */
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Fetch messages on mount
   */
  React.useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchMessages();
    } else if (sessionStatus === 'unauthenticated') {
      router.push(`/auth/signin?callbackUrl=/messages/${params.userId}`);
    }
  }, [sessionStatus, fetchMessages, router, params.userId]);

  /**
   * Poll for new messages every 10 seconds
   */
  React.useEffect(() => {
    if (sessionStatus !== 'authenticated') return;

    const interval = setInterval(() => {
      fetchMessages();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [sessionStatus, fetchMessages]);

  /**
   * Get initials for avatar
   */
  const getInitials = (user: User) => {
    if (user.fullName) {
      return user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user.username.slice(0, 2).toUpperCase();
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
   * Get project context from first message with project
   */
  const projectContext = messages.find((msg) => msg.project)?.project;

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/messages')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {partner && (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={partner.avatarUrl || undefined}
                  alt={partner.username}
                />
                <AvatarFallback>{getInitials(partner)}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-bold">
                  {partner.fullName || partner.username}
                </h1>
                {projectContext && (
                  <p className="text-sm text-muted-foreground">
                    Re: {projectContext.title}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">{error}</p>
              </div>
              <Button onClick={() => fetchMessages()} variant="outline" className="mt-4">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Messages Container */}
        <Card>
          <CardContent className="p-6">
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Messages List */}
            {!isLoading && messages.length > 0 && (
              <div className="space-y-4">
                {messages.map((message) => {
                  const isOwn = message.senderId === session?.user?.id;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`flex max-w-[70%] gap-3 ${
                          isOwn ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        {/* Avatar */}
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={message.sender.avatarUrl || undefined}
                            alt={message.sender.username}
                          />
                          <AvatarFallback>{getInitials(message.sender)}</AvatarFallback>
                        </Avatar>

                        {/* Message Bubble */}
                        <div className="space-y-1">
                          <div
                            className={`rounded-lg px-4 py-3 ${
                              isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words text-sm">
                              {message.content}
                            </p>
                          </div>
                          <p
                            className={`text-xs text-muted-foreground ${
                              isOwn ? 'text-right' : 'text-left'
                            }`}
                          >
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Empty State */}
            {!isLoading && messages.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <p>No messages yet. Start the conversation below.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Input */}
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSendMessage} className="space-y-4">
              <Textarea
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={3}
                disabled={isSending}
                className="resize-none"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={!newMessage.trim() || isSending}>
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Message
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Main page component with Suspense boundary
 * Required for useSearchParams() in Next.js 15
 */
export default function ConversationPage({ params }: { params: { userId: string } }) {
  console.log(`[${componentName}] Page rendered for user:`, params.userId);

  return (
    <React.Suspense
      fallback={
        <div className="container mx-auto max-w-4xl py-10">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <ConversationContent params={params} />
    </React.Suspense>
  );
}
