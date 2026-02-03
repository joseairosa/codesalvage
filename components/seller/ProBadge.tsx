/**
 * ProBadge Component
 *
 * Displays a verified "Pro" badge for sellers with active Pro subscriptions.
 * Only shows if the seller has an active subscription with verificationBadge benefit.
 *
 * Features:
 * - Shield icon with Pro text
 * - Consistent blue styling
 * - Reusable across the app
 *
 * @example
 * <ProBadge subscription={seller.subscription} />
 */

import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Subscription {
  status: string;
  plan?: string;
  benefits?: {
    verificationBadge: boolean;
    unlimitedProjects: boolean;
    advancedAnalytics: boolean;
    featuredListingDiscount: boolean;
  };
}

interface ProBadgeProps {
  subscription?: Subscription | null;
  size?: 'sm' | 'md' | 'lg';
}

export function ProBadge({ subscription, size = 'md' }: ProBadgeProps) {
  // Show badge if subscription is active with verificationBadge benefit,
  // or if it's an active pro plan (API shape without benefits object)
  if (!subscription || subscription.status !== 'active') {
    return null;
  }

  const hasBadge =
    subscription.benefits?.verificationBadge || subscription.plan === 'pro';
  if (!hasBadge) {
    return null;
  }

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <Badge
      variant="default"
      className="bg-blue-600 text-white hover:bg-blue-700"
      title="Verified Pro Seller"
    >
      <ShieldCheck className={`mr-1 ${sizeClasses[size]}`} />
      Pro
    </Badge>
  );
}
