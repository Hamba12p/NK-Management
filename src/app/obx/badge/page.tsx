'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import LegalConsentStep from '@/components/obx/LegalConsentStep'

type BadgeData = { roster: { full_name: string; volunteer_number: string; is_founding: boolean }; progress: { status: string; completed_at: string | null; overall_score: number | null }; legalConsent: { current: boolean } }

function badgeSvg(data: BadgeData, date: string) {
  const ribbon = data.roster.is_founding ? '<text x="540" y="1010" text-anchor="middle" fill="#782653" font-size="32" font-weight="700">FOUNDING VOLUNTEER</text>' : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" rx="36" fill="#f8f4ed"/><rect x="36" y="36" width="1008" height="1278" rx="28" fill="none" stroke="#782653" stroke-width="8"/><text x="540" y="180" text-anchor="middle" fill="#782653" font-size="34" font-family="Arial" font-weight="700" letter-spacing="8">NK UDADA</text><circle cx="540" cy="470" r="180" fill="#efe3e7"/><text x="540" y="535" text-anchor="middle" fill="#ea519d" font-size="220">✦</text><text x="540" y="760" text-anchor="middle" fill="#782653" font-size="42" font-family="Arial" font-weight="700" letter-spacing="6">VOLUNTEER</text><text x="540" y="850" text-anchor="middle" fill="#782653" font-size="48" font-family="Georgia">${data.roster.full_name}</text><text x="540" y="915" text-anchor="middle" fill="#231f20" font-size="28" font-family="monospace">${data.roster.volunteer_number}</text>${ribbon}<text x="540" y="1190" text-anchor="middle" fill="#6e646a" font-size="26" font-family="Arial">Completed ${date}</text></svg>`
}

export default function ObxBadgePage() {
  const [data, setData] = useState<BadgeData | null>(null)
  const [error, setError] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)
  const [needsLegalConsent, setNeedsLegalConsent] = useState(false)
  useEffect(() => { fetch('/api/obx/me').then(async (response) => { if (!response.ok) throw new Error('Please sign in again to view your passport.'); return response.json() }).then((value) => { if (value.progress?.status !== 'completed') { window.location.replace('/obx/trail'); return } setData(value); setNeedsLegalConsent(!value.legalConsent.current) }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Your badge is unavailable.')) }, [])
  const completionDate = useMemo(() => data?.progress.completed_at ? new Date(data.progress.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '', [data])

  async function downloadBadge() {
    if (!data) return
    await document.fonts.ready
    const image = new Image()
    image.onload = () => { const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350; const context = canvas.getContext('2d'); if (!context) return; context.drawImage(image, 0, 0); const link = document.createElement('a'); link.download = 'nk-udada-volunteer-badge.png'; link.href = canvas.toDataURL('image/png'); link.click() }
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(badgeSvg(data, completionDate))}`
  }

  async function shareBadge() {
    if (!data) return
    if (navigator.share) { await navigator.share({ title: 'My NK Udada Volunteer Badge', text: 'I completed the NK Udada volunteer onboarding course.' }).catch(() => undefined); return }
    await downloadBadge()
  }

  if (error) return <div className="mx-auto max-w-xl px-4 py-12"><p role="alert" className="rounded bg-[#efe3e7] p-5">{error}</p><Link href="/obx" className="mt-4 inline-block underline">Return to sign in</Link></div>
  if (!data) return <p className="mx-auto max-w-xl px-4 py-12 text-center" aria-live="polite">Finding your badge…</p>
  return <div className="mx-auto max-w-3xl px-4 py-8 text-center md:py-12">
    {needsLegalConsent && <LegalConsentStep onAccepted={() => setNeedsLegalConsent(false)} />}
    <p className="text-sm font-bold uppercase tracking-widest text-[#a85d88]">Your Udada Passport</p>
    <h1 className="serif-display mt-3 text-4xl text-[#782653]">You did it, {data.roster.full_name.split(' ')[0]}!</h1>
    <div ref={cardRef} className="mx-auto mt-8 max-w-lg rounded-2xl border border-[#a85d88] bg-white p-8 shadow-sm" role="img" aria-label={`Volunteer badge for ${data.roster.full_name}, ${data.roster.volunteer_number}, completed ${completionDate}`}>
      <p className="text-xs font-bold uppercase tracking-[.25em] text-[#a85d88]">NK Udada</p><div className="mx-auto my-5 grid h-20 w-20 place-items-center rounded-full bg-[#efe3e7] text-4xl text-[#ea519d]">✦</div>
      <p className="text-sm font-semibold uppercase tracking-widest text-[#782653]">Volunteer</p><h2 className="serif-display mt-2 text-3xl text-[#782653]">{data.roster.full_name}</h2>
      <p className="mt-3 font-mono text-sm">{data.roster.volunteer_number}</p>{data.roster.is_founding && <p className="mx-auto mt-4 w-fit rounded-full bg-[#efe3e7] px-4 py-2 text-sm font-bold text-[#782653]">Founding Volunteer</p>}
      <p className="mt-5 text-sm text-[#6e646a]">Completed {completionDate}</p>
    </div>
    <div className="mt-6 flex flex-wrap justify-center gap-3"><button onClick={downloadBadge} className="btn-primary">Download badge</button><button onClick={shareBadge} className="btn-secondary">Share badge</button><button onClick={() => window.print()} className="btn-secondary">Print certificate</button></div>
    <p className="mt-5 text-sm text-[#6e646a]">Your passport is complete. You can return to this badge any time.</p>
  </div>
}
