import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function ObxLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f8f4f1] text-[#241820]">
    <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
      <Link href="/obx" className="flex items-center gap-3 font-semibold text-[#782653]">
        <Image src="/logo.jpeg" alt="NK Udada" width={40} height={40} className="rounded-full" />
        <span>NK Udada</span>
      </Link>
      <Link href="/login" className="rounded border border-[#782653] px-4 py-2 text-sm font-semibold text-[#782653]">Staff sign in</Link>
    </header>
    <main>{children}</main>
    <footer className="py-8 text-center text-xs text-[#6e646a]">Your Udada Passport</footer>
  </div>
}
