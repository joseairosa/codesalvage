/**
 * Homepage
 *
 * Landing page for ProjectFinish marketplace.
 * Shows hero section, featured projects, and how it works.
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="container mx-auto flex flex-col items-center justify-center gap-6 py-20 text-center md:py-32">
        <div className="flex max-w-3xl flex-col gap-6">
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

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href="/projects">Browse Projects</Link>
            </Button>

            <Button asChild size="lg" variant="outline">
              <Link href="/auth/signin">Get Started</Link>
            </Button>
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
          <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                1
              </div>
              <h3 className="mb-2 text-xl font-semibold">List Your Project</h3>
              <p className="text-gray-600">
                Upload your incomplete project with details about completion status, tech
                stack, and known issues.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 text-2xl font-bold text-purple-600">
                2
              </div>
              <h3 className="mb-2 text-xl font-semibold">Connect with Buyers</h3>
              <p className="text-gray-600">
                Buyers browse projects, message sellers with questions, and make purchase
                decisions.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-2xl font-bold text-green-600">
                3
              </div>
              <h3 className="mb-2 text-xl font-semibold">Secure Transaction</h3>
              <p className="text-gray-600">
                Payments are processed securely with 7-day escrow protection for buyer
                confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto py-20 text-center">
        <h2 className="mb-6 text-3xl font-bold">Ready to Get Started?</h2>
        <p className="mb-8 text-lg text-gray-600">
          Join hundreds of developers buying and selling incomplete projects
        </p>
        <Button asChild size="lg">
          <Link href="/auth/signin">Sign In with GitHub</Link>
        </Button>
      </section>
    </div>
  );
}
