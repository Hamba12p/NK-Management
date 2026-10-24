'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { normaliseObxContact } from '@/lib/obx/contact'
import { OBX_CONFIG } from '@/content/obx/config'

type VolunteerLookup = { fullName: string; volunteerNumber: string }

export default function ObxWelcomePage() {
  const router = useRouter()
  const [emailInput, setEmailInput] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [volunteer, setVolunteer] = useState<VolunteerLookup | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function lookupVolunteer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const email = normaliseObxContact(emailInput)
    const phone = normaliseObxContact(phoneInput)
    if (email?.channel !== 'email' || phone?.channel !== 'phone') {
      setError('Enter a valid email address and phone number.')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/obx/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.value, phone: phone.value }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'The volunteer lookup is temporarily unavailable.')
      if (
        typeof payload.volunteer?.fullName !== 'string'
        || typeof payload.volunteer?.volunteerNumber !== 'string'
      ) {
        throw new Error('The volunteer record could not be read. Please try again.')
      }
      setVolunteer({
        fullName: payload.volunteer.fullName,
        volunteerNumber: payload.volunteer.volunteerNumber,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The volunteer lookup is temporarily unavailable.')
    } finally {
      setLoading(false)
    }
  }

  async function startObx() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/obx/session', { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Your volunteer lookup expired. Enter your details again.')
      const me = await fetch('/api/obx/me')
      if (!me.ok) throw new Error('Your passport could not be opened. Please try again.')
      const profile = await me.json()
      setMessage(`Welcome, ${volunteer?.fullName}. Your volunteer number is ${payload.volunteerNumber}.`)
      window.setTimeout(() => router.push(profile.progress?.status === 'completed' ? '/obx/badge' : '/obx/trail'), 1200)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your passport could not be opened. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function startOver() {
    setVolunteer(null)
    setError('')
    setMessage('')
  }

  return <div className="mx-auto grid max-w-5xl gap-10 px-4 pb-12 pt-8 md:grid-cols-2 md:items-center md:py-16">
    <section>
      <div className="mb-5 inline-flex rounded-full bg-[#efe3e7] px-4 py-2 text-sm font-semibold text-[#782653]">Meet Spark, your guide</div>
      <h1 className="serif-display text-4xl leading-tight text-[#782653] md:text-5xl">Your Udada Passport</h1>
      <p className="mt-5 max-w-xl text-lg leading-8">Welcome to the team. Find your volunteer record to open your passport and get ready to make a difference. It takes about 20 minutes, and you can pause any time.</p>
      <div className="mt-7 flex flex-wrap gap-3 text-sm font-semibold text-[#782653]"><span className="rounded-full bg-white px-4 py-2">Six stamps</span><span className="rounded-full bg-white px-4 py-2">One badge</span><span className="rounded-full bg-white px-4 py-2">Pause any time</span></div>
    </section>
    <div className="record-surface space-y-5 p-6 md:p-8">
      <h2 className="serif-display text-2xl text-[#782653]">{volunteer ? 'Your volunteer record' : 'Find your volunteer record'}</h2>
      {!volunteer ? <>
        <p className="text-sm leading-6 text-muted">Enter both the email and phone number recorded by your coordinator. No verification message will be sent. Anyone who knows both details can look up this volunteer record, so use a private device.</p>
        <form onSubmit={lookupVolunteer} className="space-y-5">
          <label className="block text-sm font-semibold">Rostered email address<input required autoComplete="email" inputMode="email" type="email" value={emailInput} onChange={(event) => setEmailInput(event.target.value)} placeholder="you@example.org" className="mt-2 w-full px-4 py-3" /></label>
          <label className="block text-sm font-semibold">Rostered phone number<input required autoComplete="tel" inputMode="tel" type="tel" value={phoneInput} onChange={(event) => setPhoneInput(event.target.value)} placeholder="+256…" className="mt-2 w-full px-4 py-3" /></label>
          <button disabled={loading} className="min-h-12 w-full rounded bg-[#782653] px-5 py-3 font-bold text-white disabled:opacity-60">{loading ? 'Looking up your record…' : 'Find my volunteer record'}</button>
        </form>
      </> : <div className="space-y-5">
        <p className="text-sm leading-6 text-muted">These details matched an active volunteer record. Confirm that this is you before starting your passport.</p>
        <dl className="grid gap-3 rounded-lg border border-[#dccfd6] bg-white p-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Volunteer name</dt>
            <dd className="mt-1 font-semibold text-[#782653]">{volunteer.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Volunteer number</dt>
            <dd className="mt-1 font-semibold text-[#782653]">{volunteer.volunteerNumber}</dd>
          </div>
        </dl>
        <button type="button" disabled={loading} onClick={() => void startObx()} className="min-h-12 w-full rounded bg-[#782653] px-5 py-3 font-bold text-white disabled:opacity-60">{loading ? 'Opening your passport…' : 'Start my OBX'}</button>
        <button type="button" disabled={loading} onClick={startOver} className="w-full text-sm font-semibold text-purple underline disabled:opacity-60">That is not me — try again</button>
      </div>}
      {message && <p role="status" aria-live="polite" className="rounded border border-purple/20 bg-warm/55 p-3 text-sm text-purple">{message}</p>}
      {error && <p role="alert" className="rounded border border-[#b84c1a]/30 bg-[#b84c1a]/10 p-3 text-sm text-[#8f3915]">{error}</p>}
      <p className="text-xs leading-5 text-[#6e646a]">Your name and volunteer number are displayed when both rostered details match. Your answers are used to track onboarding and can be seen by NK Udada management. {OBX_CONFIG.privacyNoticeUrl ? <Link className="underline" href={OBX_CONFIG.privacyNoticeUrl}>Privacy notice</Link> : 'Privacy notice link to be confirmed before launch.'}</p>
    </div>
  </div>
}
