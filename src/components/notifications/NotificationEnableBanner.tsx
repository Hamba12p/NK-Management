'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  enablePushNotifications,
  loadOrCreateNotificationSettings,
  pushCapabilities,
  savePushSubscription,
} from '@/lib/notifications/client'

type BannerState = 'loading' | 'enabled' | 'supported' | 'ios-home' | 'unsupported' | 'denied'

export default function NotificationEnableBanner() {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<BannerState>('loading')
  const [userId, setUserId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return
      setUserId(user.id)
      const { data: profile, error: profileError } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if (profileError || !profile) {
        if (mounted) {
          setError('Notification settings could not be checked.')
          setState('unsupported')
        }
        return
      }
      const settings = await loadOrCreateNotificationSettings(supabase, user.id, profile.role)
      if (!mounted) return
      if (settings.banner_snoozed_until && Date.parse(settings.banner_snoozed_until) > Date.now()) return

      const capability = pushCapabilities()
      if (capability.iosHomeScreenRequired) {
        setState('ios-home')
        return
      }
      if (!capability.supported) {
        setState('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        setState('denied')
        return
      }
      if (Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.getRegistration('/')
        const subscription = await registration?.pushManager.getSubscription()
        if (subscription) {
          await savePushSubscription(subscription)
          if (mounted) {
            setState('enabled')
            return
          }
        }
      }
      setState('supported')
    }
    void load().catch(() => {
      if (mounted) {
        setError('Notification settings could not be checked.')
        setState('supported')
      }
    })
    return () => { mounted = false }
  }, [supabase])

  async function snooze() {
    if (!userId) return
    setBusy(true)
    setError('')
    const { error: saveError } = await supabase
      .from('notification_settings')
      .update({
        banner_snoozed_until: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    if (saveError) setError('Your reminder could not be snoozed. Please try again.')
    else setState('enabled')
    setBusy(false)
  }

  async function enable() {
    setBusy(true)
    setError('')
    try {
      await enablePushNotifications()
      setState('enabled')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Notifications could not be enabled.')
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') setState('denied')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading' || state === 'enabled' || !userId) return null

  const text = state === 'ios-home'
    ? 'Tap Share, choose Add to Home Screen, then open NK Udada Staff Hub from your Home Screen.'
    : state === 'unsupported'
      ? 'Live alerts are not available in this browser. You can still check updates from the bell inside the Hub.'
      : state === 'denied'
        ? 'Notifications are blocked for this site. Open your browser or phone settings, allow notifications for NK Udada Staff Hub, then return here.'
        : 'Get alerts about comments, assignments and new documents. Notifications never include message content.'

  return <section aria-labelledby="notification-banner-title" className="mx-4 mb-4 flex flex-col gap-4 rounded-xl border border-[#A85D88]/30 bg-[#F8F4F1] p-4 shadow-sm sm:mx-8 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-start gap-3">
      <Image src="/logo.jpeg" alt="" width={40} height={40} className="shrink-0 rounded-full" />
      <div>
        <h2 id="notification-banner-title" className="font-bold text-[#782653]">Stay in the loop with NK Udada Staff Hub</h2>
        <p className="mt-1 text-sm leading-5 text-[#392F35]">{text}</p>
        {error && <p role="alert" className="mt-2 text-sm font-semibold text-[#B84C1A]">{error}</p>}
        <Link href="/dashboard/settings?tab=notifications" className="mt-2 inline-block text-sm font-semibold text-[#782653] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EA519D]">Learn more</Link>
      </div>
    </div>
    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
      {state === 'supported' && <button type="button" onClick={() => void enable()} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#782653] px-4 py-2 text-sm font-bold text-white hover:bg-[#5f1d41] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EA519D] disabled:opacity-60"><Bell size={16} aria-hidden="true" />{busy ? 'Turning on…' : 'Turn on notifications'}</button>}
      <button type="button" onClick={() => void snooze()} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#782653]/30 px-4 py-2 text-sm font-semibold text-[#782653] hover:bg-[#EFE3E7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EA519D] disabled:opacity-60" aria-label="Not now, remind me in seven days"><X size={16} aria-hidden="true" />Not now</button>
    </div>
  </section>
}
