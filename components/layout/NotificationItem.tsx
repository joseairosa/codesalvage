/**
 * NotificationItem Component
 *
 * Renders a single notification row within the dropdown.
 * Shows type-specific icon, title, message preview, and relative timestamp.
 */

'use client';

import { useRouter } from 'next/navigation';
import { MessageSquare, DollarSign, Star, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface NotificationItemData {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationItemProps {
  notification: NotificationItemData;
  onRead: (id: string) => void;
}

const typeIcons: Record<string, React.ElementType> = {
  new_message: MessageSquare,
  project_sold: DollarSign,
  new_review: Star,
  project_featured: Sparkles,
};

const typeColors: Record<string, string> = {
  new_message: 'text-blue-500',
  project_sold: 'text-green-500',
  new_review: 'text-yellow-500',
  project_featured: 'text-purple-500',
};

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const router = useRouter();
  const Icon = typeIcons[notification.type] || MessageSquare;
  const iconColor = typeColors[notification.type] || 'text-muted-foreground';

  const handleClick = () => {
    if (!notification.isRead) {
      onRead(notification.id);
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
        !notification.isRead ? 'bg-primary/5' : ''
      }`}
    >
      <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={`truncate text-sm ${
              !notification.isRead ? 'font-semibold' : 'font-normal text-muted-foreground'
            }`}
          >
            {notification.title}
          </p>
          {!notification.isRead && (
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {notification.message}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
    </button>
  );
}
