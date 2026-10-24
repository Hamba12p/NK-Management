'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createObxAuthClient } from '@/lib/supabase/client'
import { normaliseObxContact } from '@/lib/obx/contact'
import { OBX_CONFIG } from '@/content/obx/config'

export default function ObxWelcomePage() {
  const router = useRouter()
  const [contactInput, setContactInput] = useState('')
  const [code, setCode] = useState('')
  const [contact, setContact] = useState<ReturnType<typeof normaliseObxContact>>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function finishSession() {
    const response = await fetch('/api/obx/session', { method: 'POST' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Please request a new verification link or code.')
    const me = await fetch('/api/obx/me')
    const profile = await me.json()
    setMessage(`Your volunteer number is ${payload.volunteerNumber}.`)
    setTimeout(() => router.push(profile.progress?.status === 'completed' ? '/obx/badge' : '/obx/trail'), 1600)
  }

  async function sendVerification(value: string) {
    setLoading(true)
    setError('')
    setMessage('')
    const parsed = normaliseObxContact(value)
    if (!parsed) {
      setError('Enter a valid email address or phone number.')
      setLoading(false)
      return
    }
    try {
      const response = await fetch('/api/obx/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: parsed.value }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Verification is temporarily unavailable.')
      setContact(parsed)
      setCode('')
      setMessage(parsed.channel === 'email'
        ? 'If this email is on the approved volunteer list and email delivery is configured, a secure sign-in link will arrive shortly. Open it on this device, and check your spam folder if needed.'
        : 'If this phone is on the approved volunteer list and SMS delivery is configured, a one-time code will arrive shortly.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verification is temporarily unavailable.')
    } finally {
      setLoading(false)
    }
  }

  async function requestVerification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await sendVerification(contactInput)
  }

  async function verifyPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (contact?.channel !== 'phone') return
    setLoading(true)
    setError('')
    try {
      const auth = createObxAuthClient()
      const { error: verifyError } = await auth.auth.verifyOtp({ phone: contact.value, token: code.trim(), type: 'sms' })
      if (verifyError) throw new Error('That code is invalid or has expired. Request a new code and try again.')
      await finishSession()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not verify that code.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="mx-auto grid max-w-5xl gap-10 px-4 pb-12 pt-8 md:grid-cols-2 md:items-center md:py-16">
    <section>
      <div className="mb-5 inline-flex rounded-full bg-[#efe3e7] px-4 py-2 text-sm font-semibold text-[#782653]">Meet Spark, your guide</div>
      <h1 className="serif-display text-4xl leading-tight text-[#782653] md:text-5xl">Your Udada Passport</h1>
      <p className="mt-5 max-w-xl text-lg leading-8">Welcome to the team. Verify your volunteer contact to open your passport and get ready to make a difference. It takes about 20 minutes, and you can pause any time.</p>
      <div className="mt-7 flex flex-wrap gap-3 text-sm font-semibold text-[#782653]"><span className="rounded-full bg-white px-4 py-2">Six stamps</span><span className="rounded-full bg-white px-4 py-2">One badge</span><span className="rounded-full bg-white px-4 py-2">Pause any time</span></div>
    </section>
    <div className="record-surface space-y-5 p-6 md:p-8">
      <h2 className="serif-display text-2xl text-[#782653]">{contact ? 'Verify your contact' : 'Open your volunteer passport'}</h2>
      <ol aria-label="Verification steps" className="grid grid-cols-2 gap-3 text-xs font-semibold">
        <li className={`rounded-lg border px-3 py-2 ${contact ? 'border-[#dccfd6] bg-white text-muted' : 'border-[#782653] bg-[#efe3e7] text-[#782653]'}`}>
          <span className="mr-2" aria-hidden="true">1.</span>Your roster contact
        </li>
        <li className={`rounded-lg border px-3 py-2 ${contact ? 'border-[#782653] bg-[#efe3e7] text-[#782653]' : 'border-[#dccfd6] bg-white text-muted'}`}>
          <span className="mr-2" aria-hidden="true">2.</span>Verify and continue
        </li>
      </ol>
      {!contact ? <>
        <p className="text-sm leading-6 text-muted">Enter the email address or phone number your coordinator added to the approved volunteer list. Your assigned volunteer number will be shown after verification. If no message arrives after a minute, check spam or ask your coordinator to confirm the contact and delivery setup.</p>
        <form onSubmit={requestVerification} className="space-y-5">
          <label className="block text-sm font-semibold">Rostered email or phone number<input required autoComplete="off" inputMode="text" type="text" value={contactInput} onChange={(event) => { setContactInput(event.target.value); setError('') }} placeholder="you@example.org or +256…" className="mt-2 w-full px-4 py-3" /></label>
          <button disabled={loading} className="min-h-12 w-full rounded bg-[#782653] px-5 py-3 font-bold text-white disabled:opacity-60">{loading ? 'Sending verification…' : 'Send verification link or code'}</button>
        </form>
      </> : contact.channel === 'phone' ? <form onSubmit={verifyPhone} className="space-y-5">
        <p className="text-sm leading-6 text-muted">Enter the one-time code sent by SMS. Your volunteer number will appear after your contact is verified.</p>
        <label className="block text-sm font-semibold">SMS verification code<input required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} className="mt-2 w-full px-4 py-3" /></label>
        <button disabled={loading} className="min-h-12 w-full rounded bg-[#782653] px-5 py-3 font-bold text-white disabled:opacity-60">{loading ? 'Verifying…' : 'Verify and continue'}</button>
        <button type="button" disabled={loading} onClick={() => void sendVerification(contactInput)} className="w-full text-sm font-semibold text-purple underline disabled:opacity-60">{loading ? 'Sending code…' : 'Resend SMS code'}</button>
        <button type="button" onClick={() => { setContact(null); setCode(''); setMessage(''); setError('') }} className="w-full text-sm font-semibold text-purple underline">Use a different email or phone</button>
      </form> : <div className="space-y-4">
        <p className="text-sm leading-6 text-muted">Open the secure sign-in link sent to <span className="font-semibold text-[#782653]">{contactInput}</span> on this device. Check your spam folder if it does not arrive.</p>
        <button type="button" disabled={loading} onClick={() => void sendVerification(contactInput)} className="min-h-12 w-full rounded border border-[#782653] px-5 py-3 font-bold text-[#782653] disabled:opacity-60">{loading ? 'Sending link…' : 'Resend verification link'}</button>
        <button type="button" onClick={() => { setContact(null); setMessage(''); setError('') }} className="w-full text-sm font-semibold text-purple underline">Use a different email or phone</button>
      </div>}
      {message && <p role="status" aria-live="polite" className="rounded border border-purple/20 bg-warm/55 p-3 text-sm text-purple">{message}</p>}
      {error && <p role="alert" className="rounded border border-[#b84c1a]/30 bg-[#b84c1a]/10 p-3 text-sm text-[#8f3915]">{error}</p>}
      <p className="text-xs leading-5 text-[#6e646a]">We use your rostered email or phone to verify your identity, and your answers to track onboarding. Only NK Udada management can see them. {OBX_CONFIG.privacyNoticeUrl ? <Link className="underline" href={OBX_CONFIG.privacyNoticeUrl}>Privacy notice</Link> : 'Privacy notice link to be confirmed before launch.'}</p>
    </div>
  </div>
}
