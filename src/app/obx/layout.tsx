import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function ObxLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-surface text-text">
    <header className="mx-auto flex min-h-20 max-w-5xl items-center justify-between px-4 py-3">
      <Link href="/obx" aria-label="NK Udada passport home" className="flex items-center gap-3 font-semibold text-accent">
        <Image src="/logo.jpeg" alt="NK Udada Foundation" width={40} height={40} priority className="h-10 w-10 rounded-full object-cover" />
        <span className="hidden sm:inline">NK Udada Passport</span>
      </Link>
      <Link href="/login" className="min-h-10 rounded border border-accent px-3 py-2 text-sm font-semibold text-accent sm:px-4">Staff sign in</Link>
    </header>
    <main>{children}</main>
    <footer className="py-8 text-center text-xs text-muted">Your Udada Passport</footer>
  </div>
}
