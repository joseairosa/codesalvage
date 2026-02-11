/**
 * 404 Not Found Page
 *
 * Displayed when a user navigates to a non-existent route.
 * Uses the AI-generated not-found illustration.
 */

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <Image
        src="/images/not-found.png"
        alt="Page not found"
        width={240}
        height={240}
        className="mb-8"
        priority
      />
      <h1 className="mb-2 text-4xl font-bold">Page Not Found</h1>
      <p className="mb-8 max-w-md text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s
        get you back on track.
      </p>
      <Button asChild size="lg">
        <Link href="/">Go Home</Link>
      </Button>
    </div>
  );
}
