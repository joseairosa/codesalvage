/**
 * TransactionChat
 *
 * Inline chat panel between buyer and seller within a transaction.
 * Reuses the existing /api/messages endpoints — no new API needed.
 *
 * Responsibilities:
 * - Fetch conversation between the two parties (filtered by projectId)
 * - Render message bubbles (own = right, other = left)
 * - Allow sending new messages
 * - Poll every 10 seconds for new messages
 * - Auto-scroll to the latest message
 *
 * @example
 * <TransactionChat
 *   otherUserId={transaction.buyer.id}
 *   projectId={transaction.projectId}
 *   currentUserId={session.user.id}
 * />
 */

'use client';

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const componentName = 'TransactionChat';
const POLL_INTERVAL_MS = 10_000;

interface ChatUser {
  id: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}

interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender: ChatUser;
}

export interface TransactionChatProps {
  otherUserId: string;
  projectId: string;
  currentUserId: string;
}

function getInitials(user: ChatUser): string {
  const name = user.fullName || user.username;
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return dateString;
  }
}

export function TransactionChat({
  otherUserId,
  projectId,
  currentUserId,
}: TransactionChatProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [partner, setPartner] = React.useState<ChatUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSending, setIsSending] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [sendError, setSendError] = React.useState<string | null>(null);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const fetchMessages = React.useCallback(async () => {
    if (!otherUserId || !projectId) return;

    console.log(
      `[${componentName}] Fetching messages with:`,
      otherUserId,
      'for project:',
      projectId
    );

    try {
      const response = await fetch(`/api/messages/${otherUserId}?projectId=${projectId}`);

      if (!response.ok) {
        console.warn(`[${componentName}] Fetch failed:`, response.status);
        return;
      }

      const data = await response.json();
      setMessages(data.messages ?? []);
      if (data.partner) {
        setPartner(data.partner);
      }
    } catch (err) {
      console.error(`[${componentName}] Fetch error:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [otherUserId, projectId]);

  React.useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchMessages();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchMessages]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    setIsSending(true);
    setSendError(null);

    console.log(`[${componentName}] Sending message to:`, otherUserId);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: otherUserId,
          projectId,
          content,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send message');
      }

      const data = await response.json();
      setMessages((prev) => [...prev, data.message]);
      setDraft('');

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error(`[${componentName}] Send error:`, err);
      setSendError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const LINE_HEIGHT = 24;
    const PADDING = 16;
    const maxHeight = LINE_HEIGHT * 5 + PADDING;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, [draft]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">
            {partner
              ? `Chat with ${partner.fullName || partner.username}`
              : 'Transaction Chat'}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 pt-0">
        {/* Message list */}
        <div className="flex h-72 flex-col gap-3 overflow-y-auto rounded-lg border bg-muted/20 p-3">
          {isLoading && (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && messages.length === 0 && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              No messages yet. Start the conversation below.
            </div>
          )}

          {!isLoading &&
            messages.map((msg) => {
              const isOwn = msg.senderId === currentUserId;

              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`flex max-w-[80%] gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage
                        src={msg.sender.avatarUrl || undefined}
                        alt={msg.sender.username}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials(msg.sender)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="space-y-0.5">
                      <div
                        className={`w-full rounded-lg px-3 py-2 text-sm ${
                          isOwn
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-foreground shadow-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                      <p
                        className={`text-xs text-muted-foreground ${isOwn ? 'text-right' : 'text-left'}`}
                      >
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

          <div ref={messagesEndRef} />
        </div>

        {/* Compose */}
        <form onSubmit={handleSend} className="space-y-1">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              placeholder="Type a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isSending}
              className="min-h-9 flex-1 resize-none overflow-hidden py-2"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!draft.trim() || isSending}
              className="shrink-0"
            >
              {isSending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              Send
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Press Enter to send · Shift+Enter for new line
          </p>
          {sendError && <p className="text-xs text-destructive">{sendError}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
