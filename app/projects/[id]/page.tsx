/**
 * Project Detail Page
 *
 * Displays complete project information with image gallery, tech stack,
 * seller information, and purchase options.
 *
 * Features:
 * - Image gallery with lightbox
 * - Tech stack visualization
 * - Completion progress indicator
 * - Pricing and licensing information
 * - Seller profile card
 * - Action buttons (Buy, Contact, Favorite)
 * - Related projects section
 * - GitHub repository preview
 * - Demo/documentation links
 *
 * @example
 * /projects/abc123
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Star,
  Eye,
  Heart,
  Share2,
  MessageCircle,
  ExternalLink,
  Github,
  Globe,
  FileCode,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  ShieldCheck,
  Download,
} from 'lucide-react';

const componentName = 'ProjectDetailPage';

/**
 * Mock project data (in production, fetch from API)
 */
const mockProject = {
  id: '1',
  title: 'E-commerce Dashboard with Analytics',
  description: `A comprehensive e-commerce admin dashboard built with modern web technologies. This project provides a complete solution for managing online stores with real-time analytics, inventory management, order tracking, and customer insights.

The dashboard is built with a focus on performance and user experience, featuring:

- **Real-time Analytics**: Live sales data, revenue charts, and customer behavior tracking
- **Inventory Management**: Track stock levels, manage products, handle variants and SKUs
- **Order Processing**: Complete order lifecycle management from placement to fulfillment
- **Customer Management**: Customer profiles, purchase history, and engagement metrics
- **Payment Integration**: Fully functional Stripe integration with webhook handling
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

The backend is built with Node.js and Express, using PostgreSQL for data storage and Redis for caching. Authentication is handled via JWT with refresh token rotation for security.`,
  category: 'web_app',
  completionPercentage: 85,
  priceCents: 75000, // $750
  techStack: [
    'React',
    'Node.js',
    'PostgreSQL',
    'Tailwind CSS',
    'Stripe',
    'Redis',
    'TypeScript',
  ],
  primaryLanguage: 'TypeScript',
  frameworks: ['Next.js', 'Express', 'Prisma'],
  licenseType: 'full_code',
  accessLevel: 'full',
  thumbnailImageUrl:
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=450&fit=crop',
  screenshotUrls: [
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=450&fit=crop',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=450&fit=crop',
  ],
  githubUrl: 'https://github.com/techbuilder/ecommerce-dashboard',
  githubRepoName: 'ecommerce-dashboard',
  demoUrl: 'https://demo.ecommerce-dashboard.com',
  documentationUrl: 'https://docs.ecommerce-dashboard.com',
  demoVideoUrl: null,
  estimatedCompletionHours: 40,
  knownIssues: `- Missing admin user role management UI
- Email notifications need to be connected to SendGrid
- Product import/export CSV functionality is stubbed but not fully implemented
- Mobile responsiveness needs polish on the analytics charts
- Test coverage is at 60%, needs to reach 80%`,
  isFeatured: true,
  status: 'active',
  viewCount: 245,
  favoriteCount: 32,
  createdAt: new Date('2026-01-20'),
  updatedAt: new Date('2026-01-24'),
  seller: {
    id: 'seller1',
    username: 'techbuilder',
    fullName: 'Sarah Chen',
    avatarUrl: 'https://i.pravatar.cc/150?img=1',
    bio: 'Full-stack developer with 8 years of experience. Specialized in React, Node.js, and building scalable web applications.',
    projectsCount: 12,
    soldCount: 8,
    averageRating: 4.8,
    reviewCount: 15,
  },
};

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
 * Format date
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Get initials from name
 */
function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]?.[0]?.toUpperCase() || '?';
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase();
}

/**
 * Get license type label
 */
function getLicenseLabel(type: string): string {
  const labels: Record<string, string> = {
    full_code: 'Full Code License',
    limited: 'Limited License',
    custom: 'Custom License',
  };
  return labels[type] || type;
}

/**
 * Get access level label
 */
function getAccessLabel(level: string): string {
  const labels: Record<string, string> = {
    full: 'Full Access',
    read_only: 'Read-Only Access',
    zip_download: 'ZIP Download',
  };
  return labels[level] || level;
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  console.log(`[${componentName}] Page rendered for project:`, params.id);

  const router = useRouter();
  const [selectedImage, setSelectedImage] = React.useState(0);
  const [isFavorited, setIsFavorited] = React.useState(false);

  // In production, fetch project data using params.id
  const project = mockProject;

  const handleBuyNow = () => {
    console.log(`[${componentName}] Buy Now clicked for project:`, project.id);
    // Navigate to checkout page
    router.push(`/checkout/${project.id}`);
  };

  const handleContactSeller = () => {
    console.log(`[${componentName}] Contact Seller clicked`);
    // Navigate to messaging page
    router.push(`/messages/new?seller=${project.seller.id}&project=${project.id}`);
  };

  const handleToggleFavorite = () => {
    console.log(`[${componentName}] Toggle favorite:`, !isFavorited);
    setIsFavorited(!isFavorited);
    // In production, call API to save favorite
  };

  const handleShare = () => {
    console.log(`[${componentName}] Share clicked`);
    // Copy URL to clipboard
    navigator.clipboard.writeText(window.location.href);
    // Show toast notification
  };

  return (
    <div className="container mx-auto max-w-7xl py-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Content - Left Column (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  {project.isFeatured && (
                    <Badge variant="default" className="bg-yellow-500 text-white">
                      <Star className="mr-1 h-3 w-3" fill="currentColor" />
                      Featured
                    </Badge>
                  )}
                  <Badge variant="outline">{project.category.replace('_', ' ')}</Badge>
                </div>
                <h1 className="mb-2 text-4xl font-bold">{project.title}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span>{project.viewCount} views</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="h-4 w-4" />
                    <span>{project.favoriteCount} favorites</span>
                  </div>
                  <span>Updated {formatDate(project.updatedAt)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleToggleFavorite}
                  className={isFavorited ? 'text-red-500' : ''}
                >
                  <Heart
                    className="h-4 w-4"
                    fill={isFavorited ? 'currentColor' : 'none'}
                  />
                </Button>
                <Button variant="outline" size="icon" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Image Gallery */}
          <Card>
            <CardContent className="p-0">
              {/* Main Image */}
              <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
                <img
                  src={
                    project.screenshotUrls[selectedImage] ||
                    project.thumbnailImageUrl ||
                    ''
                  }
                  alt={`Screenshot ${selectedImage + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Thumbnail Strip */}
              {project.screenshotUrls.length > 1 && (
                <div className="flex gap-2 overflow-x-auto p-4">
                  {project.screenshotUrls.map((url, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`relative aspect-video w-24 shrink-0 overflow-hidden rounded border-2 transition-all ${selectedImage === index ? 'border-primary' : 'border-transparent hover:border-muted-foreground/50'} `}
                    >
                      <img
                        src={url}
                        alt={`Thumbnail ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Project Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {project.description.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="mb-4 whitespace-pre-line last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tech Stack */}
          <Card>
            <CardHeader>
              <CardTitle>Tech Stack</CardTitle>
              <CardDescription>
                Technologies and frameworks used in this project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">Primary Language</p>
                <Badge variant="default" className="px-3 py-1 text-base">
                  {project.primaryLanguage}
                </Badge>
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-sm font-medium">Frameworks</p>
                <div className="flex flex-wrap gap-2">
                  {project.frameworks.map((framework) => (
                    <Badge key={framework} variant="secondary" className="text-sm">
                      {framework}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-sm font-medium">All Technologies</p>
                <div className="flex flex-wrap gap-2">
                  {project.techStack.map((tech) => (
                    <Badge key={tech} variant="outline" className="text-sm">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Known Issues */}
          {project.knownIssues && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  Known Issues & Missing Features
                </CardTitle>
                <CardDescription>What still needs to be completed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {project.knownIssues.split('\n').map((issue, index) => (
                    <p key={index} className="mb-2 last:mb-0">
                      {issue}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Links */}
          <Card>
            <CardHeader>
              <CardTitle>Links & Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <Github className="h-4 w-4" />
                  <span>GitHub Repository</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {project.demoUrl && (
                <a
                  href={project.demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <Globe className="h-4 w-4" />
                  <span>Live Demo</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {project.documentationUrl && (
                <a
                  href={project.documentationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <FileCode className="h-4 w-4" />
                  <span>Documentation</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Right Column (1/3 width) */}
        <div className="space-y-6">
          {/* Purchase Card */}
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-3xl">
                {formatPrice(project.priceCents)}
              </CardTitle>
              <CardDescription>One-time purchase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Completion Progress */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Completion Status</span>
                  <span className="text-sm font-bold">
                    {project.completionPercentage}%
                  </span>
                </div>
                <Progress value={project.completionPercentage} className="h-2" />
                <p className="mt-1 text-xs text-muted-foreground">
                  {project.estimatedCompletionHours && (
                    <>Estimated {project.estimatedCompletionHours} hours to complete</>
                  )}
                </p>
              </div>

              <Separator />

              {/* License & Access */}
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">{getLicenseLabel(project.licenseType)}</p>
                    <p className="text-xs text-muted-foreground">
                      Full ownership of code
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Download className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">{getAccessLabel(project.accessLevel)}</p>
                    <p className="text-xs text-muted-foreground">
                      Complete source code & assets
                    </p>
                  </div>
                </div>
                {project.estimatedCompletionHours && (
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">
                        {project.estimatedCompletionHours} hours estimated
                      </p>
                      <p className="text-xs text-muted-foreground">
                        To finish remaining work
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button onClick={handleBuyNow} size="lg" className="w-full">
                  <DollarSign className="mr-2 h-4 w-4" />
                  Buy Now
                </Button>
                <Button
                  onClick={handleContactSeller}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Contact Seller
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>Secure Payment</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>7-Day Escrow</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seller Card */}
          <Card>
            <CardHeader>
              <CardTitle>Seller Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage
                    src={project.seller.avatarUrl || undefined}
                    alt={project.seller.username}
                  />
                  <AvatarFallback>
                    {getInitials(project.seller.fullName || project.seller.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">
                    {project.seller.fullName || project.seller.username}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    @{project.seller.username}
                  </p>
                </div>
              </div>

              {project.seller.bio && (
                <p className="text-sm text-muted-foreground">{project.seller.bio}</p>
              )}

              <Separator />

              {/* Seller Stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{project.seller.projectsCount}</p>
                  <p className="text-xs text-muted-foreground">Projects</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{project.seller.soldCount}</p>
                  <p className="text-xs text-muted-foreground">Sold</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{project.seller.averageRating}</p>
                  <p className="text-xs text-muted-foreground">Rating</p>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/sellers/${project.seller.username}`)}
              >
                View Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
