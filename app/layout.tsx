import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { env } from '@/config/env';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'ProjectFinish - Marketplace for Incomplete Software Projects',
  description:
    'Buy and sell incomplete software projects. Turn your 80% complete side project into revenue.',
  keywords: [
    'software marketplace',
    'incomplete projects',
    'side projects',
    'code marketplace',
    'developer marketplace',
  ],
  authors: [{ name: 'ProjectFinish' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: env.NEXT_PUBLIC_APP_URL,
    title: 'ProjectFinish - Marketplace for Incomplete Software Projects',
    description:
      'Buy and sell incomplete software projects. Turn your 80% complete side project into revenue.',
    siteName: 'ProjectFinish',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ProjectFinish - Marketplace for Incomplete Software Projects',
    description:
      'Buy and sell incomplete software projects. Turn your 80% complete side project into revenue.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <ErrorBoundary>
            <div className="flex min-h-screen flex-col">
              <Navigation />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
