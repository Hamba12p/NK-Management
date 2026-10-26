'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hasTwoObxIdentifiers, normaliseObxContact, normaliseObxEmail } from '@/lib/obx/contact'

type VolunteerLookup = { fullName: string; volunteerNumber: string }

export default function ObxWelcomePage() {
  const router = useRouter()
  const [fullNameInput, setFullNameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [websiteInput, setWebsiteInput] = useState('')
  const [volunteer, setVolunteer] = useState<VolunteerLookup | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const formStartedAt = useRef(Date.now())

  async function lookupVolunteer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const phone = normaliseObxContact(phoneInput)
    const fullName = fullNameInput.trim()
    const emailValue = emailInput.trim() ? normaliseObxEmail(emailInput) : null
    const phoneValue = phoneInput.trim() && phone?.channel === 'phone' ? phone.value : null
    if (
      fullName.length > 160
      || (emailInput.trim() && !emailValue)
      || (phoneInput.trim() && !phoneValue)
      || !hasTwoObxIdentifiers(fullName, emailValue, phoneValue)
    ) {
      setError('Enter any two valid details: your name, email address, or phone number.')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/obx/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email: emailValue,
          phone: phoneValue,
          website: websiteInput,
          startedAt: formStartedAt.current,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'The volunteer lookup is temporarily unavailable.')
      if (
        typeof payload.volunteer?.fullName !== 'string'
        || typeof payload.volunteer?.volunteerNumber !== 'string'
      ) {
        throw new Error('The volunteer record could not be read. Please try again.')
      }
      const record = {
        fullName: payload.volunteer.fullName,
        volunteerNumber: payload.volunteer.volunteerNumber,
      }
      setVolunteer(record)
      if (payload.isNew === true) await startObx(record.fullName)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The volunteer lookup is temporarily unavailable.')
    } finally {
      setLoading(false)
    }
  }

  async function startObx(fullName = volunteer?.fullName) {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/obx/session', { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Your volunteer lookup expired. Enter your details again.')
      const me = await fetch('/api/obx/me')
      if (!me.ok) throw new Error('Your passport could not be opened. Please try again.')
      const profile = await me.json()
      setMessage(`Welcome, ${fullName}. Your volunteer number is ${payload.volunteerNumber}.`)
      window.setTimeout(() => router.push(profile.progress?.status === 'completed' ? '/obx/badge' : '/obx/trail'), 1200)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your passport could not be opened. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function continueWithStaffHub() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/obx/staff-session', { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Sign in to StaffHub to continue.')
      router.push(payload.progressStatus === 'completed' ? '/obx/badge' : '/obx/trail')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your StaffHub passport could not be opened.')
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
      <p className="mt-5 max-w-xl text-lg leading-8">Welcome to the team. Register to receive your volunteer number and open your passport. It takes about 20 minutes, and you can pause any time.</p>
      <div className="mt-7 flex flex-wrap gap-3 text-sm font-semibold text-[#782653]"><span className="rounded-full bg-white px-4 py-2">Six stamps</span><span className="rounded-full bg-white px-4 py-2">One badge</span><span className="rounded-full bg-white px-4 py-2">Pause any time</span></div>
    </section>
    <div className="record-surface space-y-5 p-6 md:p-8">
      <h2 className="serif-display text-2xl text-[#782653]">{volunteer ? 'Your volunteer record' : 'Join the OBX'}</h2>
      {!volunteer ? <>
        <p className="text-sm leading-6 text-muted">Anyone can join. No invitation or allowed list is required. Enter any two of your name, email address, and phone number to receive a volunteer number and start your passport. These details are not verified; for existing StaffHub users, continue with your signed-in account instead.</p>
        <button type="button" disabled={loading} onClick={() => void continueWithStaffHub()} className="min-h-12 w-full rounded border border-[#782653] px-5 py-3 font-bold text-[#782653] disabled:opacity-60">{loading ? 'Opening your StaffHub passport…' : 'Continue with my StaffHub account'}</button>
        <p className="text-center text-sm text-muted">Need to sign in first? <Link className="font-semibold text-[#782653] underline" href="/login">Go to StaffHub sign in</Link>.</p>
        <form onSubmit={lookupVolunteer} className="space-y-5">
          <label className="block text-sm font-semibold">Full name <span className="font-normal text-muted">(optional)</span><input autoComplete="name" type="text" maxLength={160} value={fullNameInput} onChange={(event) => setFullNameInput(event.target.value)} placeholder="Your full name" className="mt-2 w-full px-4 py-3" /></label>
          <label className="block text-sm font-semibold">Email address <span className="font-normal text-muted">(optional)</span><input autoComplete="email" inputMode="email" type="email" value={emailInput} onChange={(event) => setEmailInput(event.target.value)} placeholder="you@example.org" className="mt-2 w-full px-4 py-3" /></label>
          <label className="block text-sm font-semibold">Phone number <span className="font-normal text-muted">(optional)</span><input autoComplete="tel" inputMode="tel" type="tel" value={phoneInput} onChange={(event) => setPhoneInput(event.target.value)} placeholder="+256…" className="mt-2 w-full px-4 py-3" /></label>
          <label aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
            Leave this field empty
            <input type="text" name="website" autoComplete="off" tabIndex={-1} value={websiteInput} onChange={(event) => setWebsiteInput(event.target.value)} />
          </label>
          <button disabled={loading} className="min-h-12 w-full rounded bg-[#782653] px-5 py-3 font-bold text-white disabled:opacity-60">{loading ? 'Creating your passport…' : 'Get my volunteer number and start'}</button>
        </form>
      </> : <div className="space-y-5">
        <p className="text-sm leading-6 text-muted">A volunteer record already exists for these details. Confirm to continue your passport.</p>
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
        <button type="button" disabled={loading} onClick={startOver} className="w-full text-sm font-semibold text-purple underline disabled:opacity-60">That is not me. Try again</button>
      </div>}
      {message && <p role="status" aria-live="polite" className="rounded border border-purple/20 bg-warm/55 p-3 text-sm text-purple">{message}</p>}
      {error && <p role="alert" className="rounded border border-[#dccfd6] bg-[#efe3e7] p-3 text-sm leading-6 text-[#782653]">{error}</p>}
      <p className="text-xs leading-5 text-[#6e646a]">Public registration does not verify your identity. Read the Privacy Notice and Volunteer MOU in the next step. Use your signed-in StaffHub account for account-linked access.</p>
    </div>
  </div>
}
