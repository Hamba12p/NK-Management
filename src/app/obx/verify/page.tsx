'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createObxAuthClient } from '@/lib/supabase/client'

export default function ObxVerifyPage() {
  const router = useRouter()
  const started = useRef(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const auth = createObxAuthClient()
    const finish = async () => {
      if (started.current) return
      started.current = true
      try {
        const { data: { session } } = await auth.auth.getSession()
        if (!session) throw new Error('This verification link is invalid or has expired. Request a new one.')
        const response = await fetch('/api/obx/session', { method: 'POST' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'This contact is not on the approved volunteer list.')
        const me = await fetch('/api/obx/me')
        const profile = await me.json()
        setMessage(`Your volunteer number is ${payload.volunteerNumber}.`)
        window.setTimeout(() => router.replace(profile.progress?.status === 'completed' ? '/obx/badge' : '/obx/trail'), 1600)
      } catch (cause) {
        started.current = false
        setError(cause instanceof Error ? cause.message : 'We could not verify this link.')
      }
    }

    const { data: { subscription } } = auth.auth.onAuthStateChange((_event, session) => {
      if (session) window.setTimeout(() => { void finish() }, 0)
    })
    void auth.auth.getSession().then(({ data: { session } }) => {
      if (session) void finish()
      else setError('This verification link is invalid or has expired. Request a new one.')
    })
    return () => subscription.unsubscribe()
  }, [router])

  return <main className="mx-auto max-w-xl px-4 py-20">
    <section className="record-surface space-y-4 p-8 text-center">
      <h1 className="serif-display text-3xl text-[#782653]">Verifying your passport</h1>
      {error
        ? <><p role="alert" className="text-sm text-[#8f3915]">{error}</p><Link href="/obx" className="btn-primary inline-flex">Return to passport</Link></>
        : <p role="status" aria-live="polite" className={message ? 'text-sm font-semibold text-purple' : 'text-sm text-muted'}>{message || 'Please wait while we verify your link and retrieve your volunteer number.'}</p>}
    </section>
  </main>
}
