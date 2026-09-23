'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import PageHeader from '@/components/PageHeader'

const links = [['Overview', ''], ['Programmes', '/programs'], ['Findings', '/findings'], ['Risks', '/risks'], ['Board briefs', '/reports']]
export default function MEFrame({ title, description, loading, error, message, children }: { title: string; description: string; loading?: boolean; error?: string; message?: string; children?: ReactNode }) {
  const path = usePathname()
  return <div>
    <PageHeader title={title} description={description} />
    <nav aria-label="M&E navigation" className="mb-6 flex flex-wrap gap-2">{links.map(([label, suffix]) => <Link key={suffix} href={`/dashboard/me${suffix}`} aria-current={path === `/dashboard/me${suffix}` ? 'page' : undefined} className={`rounded border px-4 py-2 text-sm font-semibold ${path === `/dashboard/me${suffix}` ? 'bg-purple text-cream' : 'border-purple/20 text-purple'}`}>{label}</Link>)}</nav>
    {error && <p role="alert" className="mb-5 rounded border border-rust/30 bg-rust/10 p-3 text-sm text-rust">{error}</p>}
    {message && <p role="status" className="mb-5 rounded border border-purple/20 bg-warm p-3 text-sm text-purple">{message}</p>}
    {loading ? <p role="status" className="p-12 text-center text-muted">Loading M&E records…</p> : children}
  </div>
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-semibold text-muted">{label}{children}</label>
}
export const fieldClass = 'w-full min-w-0 px-3 py-2.5'
export function Empty({ children }: { children: ReactNode }) { return <p className="p-6 text-sm text-muted">{children}</p> }
