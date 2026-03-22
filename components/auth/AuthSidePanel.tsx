/**
 * AuthSidePanel
 *
 * Abstract gradient mesh panel for auth pages (sign-in / sign-up).
 * Replaces the old static illustration with animated gradient blobs
 * and a branded tagline.
 */

import Image from 'next/image';

export function AuthSidePanel() {
  return (
    <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />

      {/* Gradient mesh blobs */}
      <div className="absolute -left-32 -top-32 h-[500px] w-[500px] animate-pulse rounded-full bg-teal-500/20 blur-[120px]" />
      <div className="absolute -bottom-40 -right-20 h-[600px] w-[600px] animate-pulse rounded-full bg-cyan-400/15 blur-[140px] [animation-delay:2s]" />
      <div className="absolute left-1/3 top-1/4 h-[400px] w-[400px] animate-pulse rounded-full bg-purple-500/10 blur-[100px] [animation-delay:4s]" />
      <div className="absolute bottom-1/4 right-1/3 h-[300px] w-[300px] animate-pulse rounded-full bg-teal-300/10 blur-[80px] [animation-delay:3s]" />

      {/* Subtle grid overlay for depth */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center px-16">
        {/* Logo */}
        <Image
          src="/images/branding/codesalvage_logo_horizontal.png"
          alt="CodeSalvage"
          width={280}
          height={63}
          className="mb-10 h-auto w-64 brightness-0 drop-shadow-2xl invert"
          priority
        />

        {/* Tagline */}
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-white">
          Where unfinished projects
          <br />
          <span className="bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">
            find new life
          </span>
        </h2>

        <p className="max-w-sm text-center text-base leading-relaxed text-slate-400">
          Join a marketplace of developers turning incomplete side projects into real
          products.
        </p>

        {/* Decorative code-like lines */}
        <div className="mt-12 w-full max-w-xs space-y-3 opacity-20">
          <div className="flex items-center gap-3">
            <div className="h-1 w-6 rounded-full bg-teal-400" />
            <div className="h-1 w-32 rounded-full bg-white/40" />
          </div>
          <div className="flex items-center gap-3 pl-4">
            <div className="h-1 w-4 rounded-full bg-cyan-400" />
            <div className="h-1 w-24 rounded-full bg-white/30" />
            <div className="h-1 w-10 rounded-full bg-teal-400/50" />
          </div>
          <div className="flex items-center gap-3 pl-8">
            <div className="h-1 w-5 rounded-full bg-purple-400" />
            <div className="h-1 w-20 rounded-full bg-white/20" />
          </div>
          <div className="flex items-center gap-3 pl-4">
            <div className="h-1 w-8 rounded-full bg-cyan-400/60" />
            <div className="h-1 w-28 rounded-full bg-white/25" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-1 w-6 rounded-full bg-teal-400" />
            <div className="h-1 w-16 rounded-full bg-white/30" />
          </div>
        </div>
      </div>
    </div>
  );
}
