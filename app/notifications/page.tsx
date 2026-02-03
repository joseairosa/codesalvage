/**
 * Notifications Page
 *
 * Full page view of all notifications with pagination and read/unread filter.
 */

'use client';

import React from 'react';
import { useSession } from '@/lib/hooks/useSession';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  NotificationItem,
  type NotificationItemData,
} from '@/components/layout/NotificationItem';

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();

  const [notifications, setNotifications] = React.useState<NotificationItemData[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<'all' | 'unread'>('all');
  const [hasMore, setHasMore] = React.useState(false);
  const [offset, setOffset] = React.useState(0);

  const fetchNotifications = React.useCallback(
    async (currentOffset: number, append: boolean = false) => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(currentOffset),
          unreadOnly: String(filter === 'unread'),
        });

        const response = await fetch(`/api/notifications?${params}`);
        if (response.ok) {
          const data = await response.json();
          if (append) {
            setNotifications((prev) => [...prev, ...data.notifications]);
          } else {
            setNotifications(data.notifications);
          }
          setUnreadCount(data.unreadCount);
          setHasMore(data.notifications.length === PAGE_SIZE);
        }
      } catch (error) {
        console.error('[NotificationsPage] Failed to fetch:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [filter]
  );

  React.useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    setOffset(0);
    fetchNotifications(0);
  }, [sessionStatus, filter, fetchNotifications]);

  const handleLoadMore = () => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchNotifications(newOffset, true);
  };

  const handleMarkRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('[NotificationsPage] Failed to mark as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllAsRead: true }),
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('[NotificationsPage] Failed to mark all as read:', error);
    }
  };

  if (sessionStatus === 'loading') {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (sessionStatus !== 'authenticated') {
    router.push('/auth/signin');
    return null;
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          variant={filter === 'unread' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('unread')}
        >
          Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </Button>
      </div>

      {/* Notification list */}
      <Card className="overflow-hidden">
        {isLoading && notifications.length === 0 ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-4 w-4 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="mx-auto h-12 w-12 text-muted-foreground/20" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground/60">
              {filter === 'unread'
                ? "You're all caught up!"
                : 'Notifications will appear here when someone messages you or interacts with your projects.'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={handleMarkRead}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Load more */}
      {hasMore && (
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
