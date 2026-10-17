'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { normaliseVolunteerNumber, normaliseEmail } from '@/lib/obx/normalise'
import { OBX_CONFIG } from '@/content/obx/config'

export default function ObxWelcomePage() {
  const router = useRouter()
  const [volunteerNumber, setVolunteerNumber] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasProgress, setHasProgress] = useState(false)
  useEffect(() => { fetch('/api/obx/me').then((response) => response.ok ? response.json() : null).then((data) => setHasProgress(!!data)).catch(() => {}) }, [])
  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/obx/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ volunteerNumber: normaliseVolunteerNumber(volunteerNumber), email: normaliseEmail(email) }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Please try again shortly.')
      const me = await fetch('/api/obx/me')
      const profile = await me.json()
      router.push(profile.progress?.status === 'completed' ? '/obx/badge' : '/obx/trail')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again shortly.')
    } finally { setLoading(false) }
  }

  return <div className="mx-auto grid max-w-5xl gap-10 px-4 pb-12 pt-8 md:grid-cols-2 md:items-center md:py-16">
    <section>
      <div className="mb-5 inline-flex rounded-full bg-[#efe3e7] px-4 py-2 text-sm font-semibold text-[#782653]">Meet Spark, your guide</div>
      <h1 className="serif-display text-4xl leading-tight text-[#782653] md:text-5xl">Your Udada Passport</h1>
      <p className="mt-5 max-w-xl text-lg leading-8">Welcome to the team. Let’s get you ready to make a difference. About 20 minutes, and you can pause any time.</p>
      <div className="mt-7 flex flex-wrap gap-3 text-sm font-semibold text-[#782653]"><span className="rounded-full bg-white px-4 py-2">Six stamps</span><span className="rounded-full bg-white px-4 py-2">One badge</span><span className="rounded-full bg-white px-4 py-2">Pause any time</span></div>
    </section>
    <form onSubmit={start} className="record-surface space-y-5 p-6 md:p-8">
      <h2 className="serif-display text-2xl text-[#782653]">Start your passport</h2>
      <label className="block text-sm font-semibold">Volunteer number<input required autoComplete="off" value={volunteerNumber} onChange={(event) => setVolunteerNumber(event.target.value)} placeholder="NKV-037" className="mt-2 w-full px-4 py-3" /></label>
      <label className="block text-sm font-semibold">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.org" className="mt-2 w-full px-4 py-3" /></label>
      {error && <p role="alert" className="rounded border border-[#b84c1a]/30 bg-[#b84c1a]/10 p-3 text-sm text-[#8f3915]">{error}</p>}
      <button disabled={loading} className="min-h-12 w-full rounded bg-[#782653] px-5 py-3 font-bold text-white disabled:opacity-60">{loading ? 'Opening your passport…' : hasProgress ? 'Continue my passport' : 'Start my passport'}</button>
      <p className="text-xs leading-5 text-[#6e646a]">We use your name, email and answers to track your onboarding. Only NK Udada management can see them. {OBX_CONFIG.privacyNoticeUrl ? <Link className="underline" href={OBX_CONFIG.privacyNoticeUrl}>Privacy notice</Link> : 'Privacy notice link to be confirmed before launch.'}</p>
      <p className="text-xs text-[#6e646a]">Already a volunteer? Take the refresher and earn your badge too.</p>
    </form>
  </div>
}
