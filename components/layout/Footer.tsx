/**
 * Footer Component
 *
 * Responsibilities:
 * - Display site footer with links
 * - Show company info and social links
 * - Provide navigation to important pages
 * - Display copyright and legal links
 * - Responsive layout
 *
 * Architecture:
 * - Server Component (static content)
 * - Organized in columns for easy navigation
 * - Accessible link labels
 * - SEO-friendly structure
 */

import Link from 'next/link';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';

/**
 * Footer link section interface
 */
interface FooterSection {
  title: string;
  links: Array<{
    label: string;
    href: string;
    external?: boolean;
  }>;
}

/**
 * Footer Component
 */
export function Footer() {
  const currentYear = new Date().getFullYear();

  const footerSections: FooterSection[] = [
    {
      title: 'Product',
      links: [
        { label: 'Browse Projects', href: '/projects' },
        { label: 'How It Works', href: '/how-it-works' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Featured Projects', href: '/featured' },
      ],
    },
    {
      title: 'For Sellers',
      links: [
        { label: 'Sell Your Project', href: '/sell' },
        { label: 'Seller Guidelines', href: '/seller-guidelines' },
        { label: 'Pricing Calculator', href: '/calculator' },
        { label: 'Success Stories', href: '/success-stories' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Documentation', href: '/docs' },
        { label: 'API', href: '/api-docs' },
        { label: 'Blog', href: '/blog' },
        { label: 'Community', href: '/community' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', href: '/about' },
        { label: 'Contact', href: '/contact' },
        { label: 'Careers', href: '/careers' },
        { label: 'Press Kit', href: '/press' },
      ],
    },
  ];

  const socialLinks = [
    {
      icon: Github,
      href: 'https://github.com/projectfinish',
      label: 'GitHub',
      external: true,
    },
    {
      icon: Twitter,
      href: 'https://twitter.com/projectfinish',
      label: 'Twitter',
      external: true,
    },
    {
      icon: Linkedin,
      href: 'https://linkedin.com/company/projectfinish',
      label: 'LinkedIn',
      external: true,
    },
    { icon: Mail, href: 'mailto:hello@projectfinish.com', label: 'Email' },
  ];

  return (
    <footer className="border-t bg-gray-50">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Main footer content */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2"
              aria-label="ProjectFinish home"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-md">
                <span className="text-xl font-bold text-white">PF</span>
              </div>
              <span className="text-xl font-bold text-gray-900">
                Project<span className="text-blue-600">Finish</span>
              </span>
            </Link>

            <p className="mt-4 text-sm text-gray-600">
              The marketplace for incomplete software projects. Buy unfinished projects
              and bring them to life.
            </p>

            {/* Social links */}
            <div className="mt-6 flex gap-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target={social.external ? '_blank' : undefined}
                    rel={social.external ? 'noopener noreferrer' : undefined}
                    className="text-gray-500 transition-colors hover:text-blue-600"
                    aria-label={social.label}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 transition-colors hover:text-blue-600"
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-gray-200 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            {/* Copyright */}
            <p className="text-sm text-gray-500">
              © {currentYear} ProjectFinish. All rights reserved.
            </p>

            {/* Legal links */}
            <div className="flex gap-6">
              <Link
                href="/privacy"
                className="text-sm text-gray-500 transition-colors hover:text-blue-600"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-gray-500 transition-colors hover:text-blue-600"
              >
                Terms of Service
              </Link>
              <Link
                href="/cookies"
                className="text-sm text-gray-500 transition-colors hover:text-blue-600"
              >
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
