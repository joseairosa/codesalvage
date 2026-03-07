/**
 * Public Seller Profile Page
 *
 * Displays a seller's public profile at /u/[username].
 * Server component — data fetched directly from Prisma for SEO.
 *
 * Shows: avatar, bio, member since, rating summary, projects grid, reviews.
 * Public route — no authentication required.
 *
 * @example /u/johndoe
 */

import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { ReviewRepository } from '@/lib/repositories/ReviewRepository';
import { ProjectCard, type ProjectCardData } from '@/components/projects/ProjectCard';
import { RatingBreakdown } from '@/components/profile/RatingBreakdown';
import { SellerReviewsSection } from '@/components/profile/SellerReviewsSection';
import { ProBadge } from '@/components/seller/ProBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Star, Package } from 'lucide-react';

const reviewRepository = new ReviewRepository(prisma);

interface PageProps {
  params: Promise<{ username: string }>;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]![0]!.toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function computeSubscriptionForCard(
  subscription: { plan: string; status: string } | null
): {
  status: string;
  benefits: {
    verificationBadge: boolean;
    unlimitedProjects: boolean;
    advancedAnalytics: boolean;
    featuredListingDiscount: boolean;
  };
} | null {
  if (!subscription || subscription.status !== 'active') return null;
  const isPro = subscription.plan === 'pro';
  return {
    status: subscription.status,
    benefits: {
      verificationBadge: isPro,
      unlimitedProjects: isPro,
      advancedAnalytics: isPro,
      featuredListingDiscount: isPro,
    },
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const normalized = username.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { username: normalized },
    select: {
      fullName: true,
      username: true,
      bio: true,
      avatarUrl: true,
      isSeller: true,
      isBanned: true,
    },
  });

  if (!user || !user.isSeller || user.isBanned) {
    return { title: 'Seller Not Found — CodeSalvage' };
  }

  const displayName = user.fullName || user.username;
  const description = user.bio || `${displayName} is a seller on CodeSalvage.`;

  return {
    title: `${user.username} — CodeSalvage`,
    description,
    alternates: {
      canonical: `${env.NEXT_PUBLIC_APP_URL}/u/${normalized}`,
    },
    openGraph: {
      title: `${displayName} (@${user.username}) — CodeSalvage`,
      description,
      type: 'profile',
      ...(user.avatarUrl ? { images: [{ url: user.avatarUrl }] } : {}),
    },
    twitter: {
      card: 'summary',
      title: `${displayName} (@${user.username}) — CodeSalvage`,
      description,
      ...(user.avatarUrl ? { images: [user.avatarUrl] } : {}),
    },
  };
}

export default async function SellerProfilePage({ params }: PageProps) {
  const { username } = await params;
  const normalized = username.toLowerCase();

  // Canonical redirect for mixed-case URLs
  if (username !== normalized) {
    redirect(`/u/${normalized}`);
  }

  const user = await prisma.user.findUnique({
    where: { username: normalized },
    select: {
      id: true,
      username: true,
      fullName: true,
      bio: true,
      avatarUrl: true,
      isSeller: true,
      isBanned: true,
      createdAt: true,
      subscription: { select: { plan: true, status: true } },
    },
  });

  if (!user || !user.isSeller || user.isBanned) {
    notFound();
  }

  const [projects, ratingStats, initialReviewsData] = await Promise.all([
    prisma.project.findMany({
      where: { sellerId: user.id, status: { in: ['active', 'sold'] }, isApproved: true },
      include: { seller: { include: { subscription: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    reviewRepository.getSellerRatingStats(user.id),
    reviewRepository.getSellerReviews(user.id, { page: 1, limit: 10 }),
  ]);

  // Map to ProjectCardData shape (status tracked separately for the sold badge)
  const projectCards: Array<ProjectCardData & { status: string }> = projects.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    category: p.category,
    completionPercentage: p.completionPercentage,
    priceCents: p.priceCents,
    techStack: p.techStack,
    thumbnailImageUrl: p.thumbnailImageUrl,
    screenshotUrls: p.screenshotUrls,
    isFeatured: p.isFeatured,
    viewCount: p.viewCount,
    favoriteCount: p.favoriteCount,
    status: p.status,
    seller: {
      id: p.seller.id,
      username: p.seller.username,
      fullName: p.seller.fullName,
      avatarUrl: p.seller.avatarUrl,
      subscription: computeSubscriptionForCard(p.seller.subscription) ?? null,
    },
  }));

  // Mask anonymous buyers in initial reviews
  const initialReviews = initialReviewsData.reviews.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    buyer: r.isAnonymous
      ? { id: r.buyer.id, username: 'Anonymous', fullName: null, avatarUrl: null }
      : r.buyer,
  }));

  const displayName = user.fullName || user.username;
  const memberSince = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(user.createdAt);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      {/* Profile Header */}
      <div className="mb-10 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <Avatar className="h-24 w-24 flex-shrink-0 ring-2 ring-border">
          <AvatarImage src={user.avatarUrl || undefined} alt={displayName} />
          <AvatarFallback className="text-2xl">{getInitials(displayName)}</AvatarFallback>
        </Avatar>

        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{displayName}</h1>
            <ProBadge
              subscription={computeSubscriptionForCard(user.subscription ?? null)}
              size="sm"
            />
          </div>
          <p className="text-muted-foreground">@{user.username}</p>

          {user.bio && (
            <p className="mt-2 max-w-xl text-sm text-foreground">{user.bio}</p>
          )}

          <div className="mt-3 flex flex-wrap justify-center gap-4 sm:justify-start">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Member since {memberSince}
            </div>

            {ratingStats.totalReviews > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">
                  {ratingStats.averageRating.toFixed(1)}
                </span>
                <span className="text-muted-foreground">
                  ({ratingStats.totalReviews} review
                  {ratingStats.totalReviews !== 1 ? 's' : ''})
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              {projectCards.length} project{projectCards.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold">Projects</h2>
        {projectCards.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No projects listed yet.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projectCards.map((project) => (
              <div key={project.id} className="relative">
                {project.status === 'sold' && (
                  <Badge className="absolute right-2 top-2 z-10 bg-gray-700 text-white">
                    Sold
                  </Badge>
                )}
                <ProjectCard project={project} showSellerInfo={false} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reviews Section */}
      <section>
        <h2 className="mb-6 text-xl font-semibold">Reviews</h2>

        {ratingStats.totalReviews > 0 && (
          <div className="mb-6 max-w-xs">
            <RatingBreakdown
              averageRating={ratingStats.averageRating}
              totalReviews={ratingStats.totalReviews}
              ratingBreakdown={ratingStats.ratingBreakdown}
            />
          </div>
        )}

        <SellerReviewsSection
          username={user.username}
          initialReviews={initialReviews}
          initialPagination={{
            total: initialReviewsData.total,
            page: initialReviewsData.page,
            limit: initialReviewsData.limit,
            totalPages: initialReviewsData.totalPages,
            hasNext: initialReviewsData.hasNext,
            hasPrev: initialReviewsData.hasPrev,
          }}
        />
      </section>
    </div>
  );
}
