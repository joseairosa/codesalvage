/**
 * How It Works Page
 *
 * Explains the CodeSalvage marketplace for both buyers and sellers.
 * Shows the complete process from listing to purchase to ownership transfer.
 *
 * Sections:
 * - Hero introduction
 * - For Buyers: 5-step flow — Browse → Purchase → Review → Transfer → Funds
 * - For Sellers: List → Set Price → Await Purchase → Get Paid
 * - Trust & Safety features
 * - CTA sections
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Search,
  ShoppingCart,
  GitBranch,
  DollarSign,
  Upload,
  Shield,
  Clock,
  CheckCircle,
  Users,
  Star,
  Lock,
  ArrowRight,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'How It Works - CodeSalvage',
  description:
    'Learn how CodeSalvage works for buyers and sellers. Browse incomplete projects, purchase code, and bring your ideas to life.',
};

interface ProcessStep {
  icon: React.ElementType;
  image: string;
  imageAlt: string;
  title: string;
  description: string;
  details: string;
}

export default function HowItWorksPage() {
  const buyerSteps: ProcessStep[] = [
    {
      icon: Search,
      image: '/images/step-list.png',
      imageAlt: 'Browse projects in the marketplace',
      title: '1. Browse Projects',
      description: 'Explore our marketplace of incomplete software projects',
      details:
        "Search by technology, completion percentage, price, or category. Each project shows what's done, what's left, and known issues.",
    },
    {
      icon: ShoppingCart,
      image: '/images/step-secure.png',
      imageAlt: 'Secure payment with escrow',
      title: '2. Purchase Securely',
      description: 'Buy with confidence — your payment is protected',
      details:
        'Your payment is held in escrow and you are immediately added as a GitHub collaborator, so you can start reviewing the code right away.',
    },
    {
      icon: Clock,
      image: '/images/step-review.png',
      imageAlt: '7-day code review period',
      title: '3. 7-Day Review',
      description: 'Review the code as a collaborator before committing',
      details:
        "You have 7 days from purchase to review the repository. If something doesn't match the description, raise a concern within this window.",
    },
    {
      icon: GitBranch,
      image: '/images/step-transfer.png',
      imageAlt: 'Repository ownership transferred to buyer',
      title: '4. Ownership Transfer',
      description: 'Full GitHub ownership transferred to your account',
      details:
        'After the review period, full repository ownership is automatically transferred to your GitHub account. You become the new owner.',
    },
    {
      icon: DollarSign,
      image: '/images/step-earn.png',
      imageAlt: 'Escrow funds released to seller',
      title: '5. Funds Released',
      description: 'Escrow is released once ownership is confirmed',
      details:
        'Once ownership transfer is complete, the escrowed funds are released to the seller. The deal is done — the project is yours.',
    },
  ];

  const sellerSteps: ProcessStep[] = [
    {
      icon: Upload,
      image: '/images/step-list.png',
      imageAlt: 'Upload your project to the marketplace',
      title: '1. List Your Project',
      description: 'Upload your incomplete project with details',
      details:
        "Provide title, description, tech stack, completion percentage, known issues, and screenshots. Be transparent about what works and what doesn't.",
    },
    {
      icon: DollarSign,
      image: '/images/step-price.png',
      imageAlt: 'Set your project price',
      title: '2. Set Your Price',
      description: 'Choose a fair price based on completeness',
      details:
        'Consider how much work is done, quality of code, and market demand. Platform takes 18% commission after successful sale.',
    },
    {
      icon: CheckCircle,
      image: '/images/step-connect.png',
      imageAlt: 'Buyer gets automatic collaborator access',
      title: '3. Buyer Gets Access',
      description: 'Collaborator access is granted automatically',
      details:
        "When a buyer submits their GitHub username, they're automatically added as a collaborator. No manual action needed from you — the platform handles it.",
    },
    {
      icon: Lock,
      image: '/images/step-earn.png',
      imageAlt: 'Earn money after ownership transfer',
      title: '4. Get Paid',
      description: 'Receive payment after ownership transfer',
      details:
        'After the 7-day review period, repository ownership transfers to the buyer automatically. Once the transfer is confirmed, funds are released to your account.',
    },
  ];

  const trustFeatures = [
    {
      icon: Shield,
      title: '7-Day Review Window',
      description:
        'All payments held in escrow while you review the code as a collaborator. Raise any concerns within 7 days of purchase.',
    },
    {
      icon: Star,
      title: 'Seller Reviews & Ratings',
      description:
        'Rate sellers on code quality, documentation, responsiveness, and accuracy. Build reputation over time.',
    },
    {
      icon: GitBranch,
      title: 'Collaborator Access on Purchase',
      description:
        'Added as a GitHub collaborator immediately after purchase. Review the real repository — not just a download — before ownership transfers.',
    },
    {
      icon: Users,
      title: 'Verified Sellers',
      description:
        'Pro sellers display verification badges. GitHub integration shows real commit history and contribution activity.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Hero Section */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              How CodeSalvage Works
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              A marketplace connecting developers with incomplete software projects.
              Buyers get a head start on development. Sellers monetize their unfinished
              work.
            </p>
          </div>
        </div>
      </div>

      {/* For Buyers Section */}
      <div className="border-b bg-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                For Buyers
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Skip months of development by starting with existing code
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {buyerSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <Card
                    key={index}
                    className="overflow-hidden transition-shadow hover:shadow-lg"
                  >
                    <div className="flex h-40 items-center justify-center">
                      <Image
                        src={step.image}
                        alt={step.imageAlt}
                        width={160}
                        height={160}
                        className="h-32 w-32 object-contain"
                      />
                    </div>
                    <CardHeader>
                      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                        <Icon className="h-5 w-5 text-blue-600" />
                      </div>
                      <CardTitle className="text-xl">{step.title}</CardTitle>
                      <CardDescription className="text-base">
                        {step.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600">{step.details}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mt-12 text-center">
              <Button
                asChild
                size="lg"
                className="shadow-md transition-transform hover:scale-105"
              >
                <Link href="/projects">
                  Browse Projects <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* For Sellers Section */}
      <div className="border-b bg-gray-50 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                For Sellers
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Turn your incomplete projects into income
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              {sellerSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <Card
                    key={index}
                    className="overflow-hidden transition-shadow hover:shadow-lg"
                  >
                    <div className="flex h-40 items-center justify-center">
                      <Image
                        src={step.image}
                        alt={step.imageAlt}
                        width={160}
                        height={160}
                        className="h-32 w-32 object-contain"
                      />
                    </div>
                    <CardHeader>
                      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                        <Icon className="h-5 w-5 text-purple-600" />
                      </div>
                      <CardTitle className="text-xl">{step.title}</CardTitle>
                      <CardDescription className="text-base">
                        {step.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600">{step.details}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mt-12 text-center">
              <Button
                asChild
                size="lg"
                variant="outline"
                className="shadow-md transition-transform hover:scale-105"
              >
                <Link href="/auth/signin">
                  Start Selling <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Trust & Safety Section */}
      <div className="border-b bg-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                Trust & Safety Features
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Built-in protections for buyers and sellers
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {trustFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                      <Icon className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-gray-900">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Info Section */}
      <div className="bg-gray-50 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 p-px">
              <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 px-8 py-10 sm:px-12">
                <h3 className="text-2xl font-bold text-white">Transparent Pricing</h3>
                <p className="mt-2 text-blue-100">
                  No hidden fees. Know exactly what you pay or earn.
                </p>

                <div className="mt-8 grid gap-6 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/10 p-5 backdrop-blur-sm">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                      <DollarSign className="h-5 w-5 text-white" />
                    </div>
                    <p className="font-semibold text-white">Buyers: Listed Price</p>
                    <p className="mt-1 text-sm text-blue-100">
                      No additional fees. What you see is what you pay.
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/10 p-5 backdrop-blur-sm">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                      <CheckCircle className="h-5 w-5 text-white" />
                    </div>
                    <p className="font-semibold text-white">Sellers: 82% Earnings</p>
                    <p className="mt-1 text-sm text-blue-100">
                      18% platform commission covers payments, escrow, hosting, and
                      support.
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/10 p-5 backdrop-blur-sm">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    <p className="font-semibold text-white">7-Day Review + Transfer</p>
                    <p className="mt-1 text-sm text-blue-100">
                      Escrow held during review. Released after ownership transfer — not
                      just a timer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="border-t bg-gradient-to-r from-blue-600 to-purple-600 py-16">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-blue-100">
            Join thousands of developers buying and selling incomplete software projects.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="shadow-lg transition-transform hover:scale-105"
            >
              <Link href="/projects">Browse Projects</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white bg-white/10 text-white shadow-lg backdrop-blur transition-transform hover:scale-105 hover:bg-white/20"
            >
              <Link href="/auth/signin">Start Selling</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
