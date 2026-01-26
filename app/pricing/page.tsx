/**
 * Pricing Page (Public)
 *
 * Displays subscription pricing for Free vs Pro plans.
 * Shows benefits comparison and upgrade options.
 *
 * Route: /pricing
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { auth } from '@/auth';

export default async function PricingPage() {
  const session = await auth();
  const isAuthenticated = !!session?.user;
  const isSeller = session?.user?.isSeller;

  return (
    <div className="container mx-auto py-16">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold">Choose Your Plan</h1>
        <p className="text-lg text-gray-600">
          Start with our free plan or upgrade to Pro for unlimited projects and advanced features
        </p>
      </div>

      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
        {/* Free Plan */}
        <Card className="relative">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-2xl">Free</span>
              <Badge variant="secondary">Current</Badge>
            </CardTitle>
            <div className="mt-4">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-gray-600">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-semibold">What's included:</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="mt-1 h-5 w-5 flex-shrink-0 text-green-600" />
                  <span>Up to 3 active project listings</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-1 h-5 w-5 flex-shrink-0 text-green-600" />
                  <span>Basic project analytics</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-1 h-5 w-5 flex-shrink-0 text-green-600" />
                  <span>Messaging with buyers</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-1 h-5 w-5 flex-shrink-0 text-green-600" />
                  <span>Standard featured listing pricing</span>
                </li>
                <li className="flex items-start gap-2 text-gray-400">
                  <span className="mt-1 h-5 w-5 flex-shrink-0">✕</span>
                  <span>Unlimited projects</span>
                </li>
                <li className="flex items-start gap-2 text-gray-400">
                  <span className="mt-1 h-5 w-5 flex-shrink-0">✕</span>
                  <span>Advanced analytics dashboard</span>
                </li>
                <li className="flex items-start gap-2 text-gray-400">
                  <span className="mt-1 h-5 w-5 flex-shrink-0">✕</span>
                  <span>20% featured listing discount</span>
                </li>
                <li className="flex items-start gap-2 text-gray-400">
                  <span className="mt-1 h-5 w-5 flex-shrink-0">✕</span>
                  <span>Verified seller badge</span>
                </li>
              </ul>
            </div>

            {!isAuthenticated ? (
              <Button asChild className="w-full" variant="outline">
                <Link href="/auth/signin">Sign In to Get Started</Link>
              </Button>
            ) : !isSeller ? (
              <Button asChild className="w-full" variant="outline">
                <Link href="/seller/onboard">Become a Seller</Link>
              </Button>
            ) : (
              <Button disabled className="w-full" variant="outline">
                Current Plan
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Pro Plan */}
        <Card className="relative border-2 border-blue-600 shadow-lg">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <Badge className="bg-blue-600 text-white">Most Popular</Badge>
          </div>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-2xl">Pro</span>
              <Badge className="bg-blue-600">Recommended</Badge>
            </CardTitle>
            <div className="mt-4">
              <span className="text-4xl font-bold">$9.99</span>
              <span className="text-gray-600">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-semibold">Everything in Free, plus:</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <span className="font-semibold">Unlimited active project listings</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <span className="font-semibold">Advanced analytics dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <span>Revenue tracking and insights</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <span className="font-semibold">20% discount on featured listings</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <span>Save up to $16/month on featured placements</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <span className="font-semibold">Verified seller badge</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <span>Priority support</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <span>Cancel anytime</span>
                </li>
              </ul>
            </div>

            {!isAuthenticated ? (
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                <Link href="/auth/signin">Sign In to Upgrade</Link>
              </Button>
            ) : !isSeller ? (
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                <Link href="/seller/onboard">Become a Seller</Link>
              </Button>
            ) : (
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                <Link href="/seller/subscription">Upgrade to Pro</Link>
              </Button>
            )}

            <p className="text-center text-xs text-gray-600">
              Billed monthly. Cancel anytime. No hidden fees.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Featured Listing Discount Example */}
      <div className="mx-auto mt-16 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Featured Listing Savings with Pro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Duration</th>
                    <th className="py-2 text-right">Free Plan</th>
                    <th className="py-2 text-right">Pro Plan (20% off)</th>
                    <th className="py-2 text-right font-semibold text-green-600">You Save</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3">7 days</td>
                    <td className="py-3 text-right">$29.99</td>
                    <td className="py-3 text-right font-semibold text-blue-600">$23.99</td>
                    <td className="py-3 text-right font-semibold text-green-600">$6.00</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3">14 days</td>
                    <td className="py-3 text-right">$49.99</td>
                    <td className="py-3 text-right font-semibold text-blue-600">$39.99</td>
                    <td className="py-3 text-right font-semibold text-green-600">$10.00</td>
                  </tr>
                  <tr>
                    <td className="py-3">30 days</td>
                    <td className="py-3 text-right">$79.99</td>
                    <td className="py-3 text-right font-semibold text-blue-600">$63.99</td>
                    <td className="py-3 text-right font-semibold text-green-600">$16.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-center text-sm text-gray-600">
              Feature just 2 projects per month and Pro pays for itself! 💰
            </p>
          </CardContent>
        </Card>
      </div>

      {/* FAQ Section */}
      <div className="mx-auto mt-16 max-w-3xl">
        <h2 className="mb-8 text-center text-3xl font-bold">Frequently Asked Questions</h2>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Can I switch plans anytime?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Yes! You can upgrade to Pro instantly or cancel your Pro subscription at any time. When
                you cancel, you'll continue to have Pro benefits until the end of your billing period.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What happens if I hit the 3-project limit?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                On the Free plan, you can have up to 3 active listings. To create more, you'll need to
                either delist an existing project or upgrade to Pro for unlimited listings.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How does the featured listing discount work?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Pro subscribers automatically receive 20% off all featured placement purchases. The
                discount is applied at checkout, and there's no limit to how many times you can use it.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Is there a contract or commitment?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                No! Pro is billed monthly with no long-term commitment. Cancel anytime from your
                subscription settings.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
