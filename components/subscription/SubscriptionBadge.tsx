/**
 * Subscription Badge Component
 *
 * Displays user's subscription status (Free/Pro) as a badge.
 * Can be used in navigation, dashboard, or seller profiles.
 */

import { Badge } from '@/components/ui/badge';
import { Crown } from 'lucide-react';

interface SubscriptionBadgeProps {
  plan: 'free' | 'pro';
  className?: string;
  showIcon?: boolean;
}

export function SubscriptionBadge({
  plan,
  className = '',
  showIcon = true,
}: SubscriptionBadgeProps) {
  if (plan === 'pro') {
    return (
      <Badge className={`bg-blue-600 text-white ${className}`}>
        {showIcon && <Crown className="mr-1 h-3 w-3" />}
        Pro
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={className}>
      Free
    </Badge>
  );
}
