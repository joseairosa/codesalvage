/**
 * ProjectCard Component
 *
 * Displays a project listing card with hover effects.
 * Used in search results, homepage featured section, and seller dashboard.
 *
 * Features:
 * - Project thumbnail with fallback
 * - Title, description preview (truncated)
 * - Price display (formatted USD)
 * - Completion percentage with visual indicator
 * - Tech stack badges (first 3, then "+ X more")
 * - Seller information with avatar
 * - Featured badge
 * - Hover effects (shadow, scale)
 * - Click to navigate to project detail page
 *
 * @example
 * <ProjectCard project={project} />
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Eye, Heart } from 'lucide-react';

const componentName = 'ProjectCard';

/**
 * Project data type (matches Prisma schema subset)
 */
export interface ProjectCardData {
  id: string;
  title: string;
  description: string;
  category: string;
  completionPercentage: number;
  priceCents: number;
  techStack: string[];
  thumbnailImageUrl?: string | null;
  isFeatured: boolean;
  viewCount: number;
  favoriteCount: number;
  seller: {
    id: string;
    username: string;
    fullName?: string | null;
    avatarUrl?: string | null;
  };
}

export interface ProjectCardProps {
  project: ProjectCardData;
  showSellerInfo?: boolean;
  showStats?: boolean;
  className?: string;
}

/**
 * Format price in cents to USD display
 */
function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Get completion color based on percentage
 */
function getCompletionColor(percentage: number): string {
  if (percentage >= 90) return 'text-green-600 dark:text-green-400';
  if (percentage >= 75) return 'text-blue-600 dark:text-blue-400';
  if (percentage >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-orange-600 dark:text-orange-400';
}

/**
 * Get completion label based on percentage
 */
function getCompletionLabel(percentage: number): string {
  if (percentage >= 90) return 'Nearly Complete';
  if (percentage >= 75) return 'Well Advanced';
  if (percentage >= 60) return 'Good Progress';
  return 'Good Start';
}

/**
 * Truncate description to max length
 */
function truncateDescription(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Get initials from name for avatar fallback
 */
function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]![0]!.toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function ProjectCard({
  project,
  showSellerInfo = true,
  showStats = true,
  className = '',
}: ProjectCardProps) {
  console.log(`[${componentName}] Rendering card for project:`, project.id);

  const maxVisibleTags = 3;
  const visibleTechStack = project.techStack.slice(0, maxVisibleTags);
  const remainingCount = project.techStack.length - maxVisibleTags;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card
        className={`group h-full cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:border-primary/50 hover:shadow-lg ${className} `}
      >
        {/* Thumbnail Image */}
        <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
          {project.thumbnailImageUrl ? (
            <img
              src={project.thumbnailImageUrl}
              alt={project.title}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
              <span className="text-4xl font-bold text-muted-foreground/30">
                {project.title[0]?.toUpperCase() || '?'}
              </span>
            </div>
          )}

          {/* Featured Badge */}
          {project.isFeatured && (
            <div className="absolute left-2 top-2">
              <Badge variant="default" className="bg-yellow-500 text-white">
                <Star className="mr-1 h-3 w-3" fill="currentColor" />
                Featured
              </Badge>
            </div>
          )}

          {/* Completion Badge */}
          <div className="absolute bottom-2 right-2">
            <Badge
              variant="secondary"
              className={`font-semibold ${getCompletionColor(project.completionPercentage)}`}
            >
              {project.completionPercentage}% Complete
            </Badge>
          </div>
        </div>

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 text-lg">{project.title}</CardTitle>
            <Badge variant="outline" className="shrink-0 text-xs">
              {project.category.replace('_', ' ')}
            </Badge>
          </div>
          <CardDescription className="line-clamp-2 text-sm">
            {truncateDescription(project.description)}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Tech Stack */}
          <div className="flex flex-wrap gap-1.5">
            {visibleTechStack.map((tech) => (
              <Badge key={tech} variant="secondary" className="text-xs">
                {tech}
              </Badge>
            ))}
            {remainingCount > 0 && (
              <Badge variant="secondary" className="text-xs text-muted-foreground">
                +{remainingCount} more
              </Badge>
            )}
          </div>

          {/* Price and Completion Label */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{formatPrice(project.priceCents)}</p>
              <p
                className={`text-xs ${getCompletionColor(project.completionPercentage)}`}
              >
                {getCompletionLabel(project.completionPercentage)}
              </p>
            </div>

            {/* Stats */}
            {showStats && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  <span>{project.viewCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5" />
                  <span>{project.favoriteCount}</span>
                </div>
              </div>
            )}
          </div>

          {/* Seller Info */}
          {showSellerInfo && (
            <div className="flex items-center gap-2 border-t pt-3">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={project.seller.avatarUrl || undefined}
                  alt={project.seller.username}
                />
                <AvatarFallback className="text-xs">
                  {getInitials(project.seller.fullName || project.seller.username)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">
                  {project.seller.fullName || project.seller.username}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{project.seller.username}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
