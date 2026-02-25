/**
 * Homepage
 *
 * Landing page for CodeSalvage marketplace.
 * Shows hero section, featured projects, and how it works.
 */

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-static';

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="container mx-auto flex flex-col items-center justify-center gap-6 py-20 md:py-32">
        <div className="flex w-full max-w-5xl flex-col items-center gap-10 md:flex-row">
          <div className="flex flex-1 flex-col gap-6 text-center md:text-left">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Turn Your{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Incomplete Projects
              </span>{' '}
              into Revenue
            </h1>

            <p className="text-lg text-gray-600 sm:text-xl">
              Buy and sell software projects that are 50-95% complete. Your abandoned side
              project could be someone else's perfect starting point.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center md:justify-start">
              <Button asChild size="lg">
                <Link href="/projects">Browse Projects</Link>
              </Button>

              <Button asChild size="lg" variant="outline">
                <Link href="/auth/signin">Get Started</Link>
              </Button>
            </div>
          </div>

          <div className="flex-1">
            <Image
              src="/images/hero-illustration.png"
              alt="Developer working on code projects"
              width={600}
              height={338}
              className="rounded-lg"
              priority
            />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold">500+</div>
            <div className="text-sm text-gray-600">Projects Listed</div>
          </div>
          <div>
            <div className="text-3xl font-bold">100+</div>
            <div className="text-sm text-gray-600">Transactions</div>
          </div>
          <div>
            <div className="text-3xl font-bold">4.8★</div>
            <div className="text-sm text-gray-600">Average Rating</div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="border-t bg-gray-50 py-20">
        <div className="container mx-auto">
          <h2 className="mb-4 text-center text-3xl font-bold">How It Works</h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-gray-600">
            Like a test drive — buyers get real collaborator access to review the code
            before full ownership transfers.
          </p>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 h-32 w-32 overflow-hidden rounded-2xl">
                <Image
                  src="/images/step-secure.png"
                  alt="Purchase and get collaborator access"
                  width={128}
                  height={128}
                  className="h-full w-full object-cover"
                />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Buy &amp; Get Access</h3>
              <p className="text-gray-600">
                Purchase a project and you&apos;re immediately added as a GitHub
                collaborator — review the real code before committing to ownership.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="mb-4 h-32 w-32 overflow-hidden rounded-2xl">
                <Image
                  src="/images/step-review.png"
                  alt="7-day review period"
                  width={128}
                  height={128}
                  className="h-full w-full object-cover"
                />
              </div>
              <h3 className="mb-2 text-xl font-semibold">7-Day Test Drive</h3>
              <p className="text-gray-600">
                You have 7 days to review the codebase as a collaborator. Raise any
                concerns within this window — your payment stays in escrow until then.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="mb-4 h-32 w-32 overflow-hidden rounded-2xl">
                <Image
                  src="/images/step-transfer.png"
                  alt="Ownership transfer"
                  width={128}
                  height={128}
                  className="h-full w-full object-cover"
                />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Ownership Transfers</h3>
              <p className="text-gray-600">
                After the review period, full repository ownership is automatically
                transferred to your GitHub account and funds are released to the seller.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Button asChild variant="outline" size="lg">
              <Link href="/how-it-works">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <Image
            src="/images/cta-illustration.png"
            alt="Developers collaborating"
            width={600}
            height={338}
            className="mx-auto mb-8 rounded-lg"
          />
          <h2 className="mb-6 text-3xl font-bold">Ready to Get Started?</h2>
          <p className="mb-8 text-lg text-gray-600">
            Join hundreds of developers buying and selling incomplete projects
          </p>
          <Button asChild size="lg">
            <Link href="/auth/signin">Sign In with GitHub</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
