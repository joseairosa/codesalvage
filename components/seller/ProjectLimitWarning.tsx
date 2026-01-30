/**
 * ProjectLimitWarning Component
 *
 * Displays when a free tier seller has reached their 3-project limit.
 * Shows upgrade prompt with benefits and call-to-action button.
 *
 * Features:
 * - Clear explanation of the limit
 * - Pro plan benefits list
 * - Upgrade button linking to pricing page
 * - Professional, encouraging tone
 *
 * @example
 * <ProjectLimitWarning projectCount={3} />
 */

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

interface ProjectLimitWarningProps {
  projectCount: number;
}

export function ProjectLimitWarning({ projectCount }: ProjectLimitWarningProps) {
  return (
    <div className="container mx-auto max-w-2xl py-12">
      <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20">
        <CardHeader>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 shrink-0 text-yellow-600 dark:text-yellow-500" />
            <div>
              <CardTitle className="text-2xl">Project Limit Reached</CardTitle>
              <CardDescription className="mt-1.5 text-base text-foreground/80">
                You've reached the maximum of {projectCount} active projects on the Free
                plan
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            To create more projects and grow your business, upgrade to Pro and unlock
            unlimited project listings plus additional premium features.
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-blue-600">
                <Sparkles className="mr-1 h-3 w-3" />
                Pro Benefits
              </Badge>
            </div>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>
                  <strong>Unlimited Projects</strong> - List as many projects as you want
                </span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>
                  <strong>Advanced Analytics</strong> - Detailed insights into your sales
                  performance
                </span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>
                  <strong>Featured Listing Discounts</strong> - 20% off featured
                  placements
                </span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>
                  <strong>Verified Pro Badge</strong> - Build trust with the Pro seller
                  badge
                </span>
              </li>
            </ul>
          </div>

          <div className="flex gap-3 pt-2">
            <Button asChild size="lg" className="flex-1">
              <Link href="/pricing">
                Upgrade to Pro
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/seller/projects">View My Projects</Link>
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Only <strong>$9.99/month</strong> • Cancel anytime
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
