'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  enablePushNotifications,
  loadOrCreateNotificationSettings,
  pushCapabilities,
  removePushSubscription,
  savePushSubscription,
  type NotificationSettings as SettingsRecord,
  type PushDevice,
} from '@/lib/notifications/client'

type Preferences = { notifications_enabled: boolean; dark_mode: boolean; email_digest: boolean }

function formatUsed(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function NotificationSettings({ userId, role }: { userId: string; role: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [settings, setSettings] = useState<SettingsRecord | null>(null)
  const [preferences, setPreferences] = useState<Preferences>({ notifications_enabled: true, dark_mode: false, email_digest: false })
  const [devices, setDevices] = useState<PushDevice[]>([])
  const [currentDeviceId, setCurrentDeviceId] = useState('')
  const [permission, setPermission] = useState('Checking browser permission')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const supported = pushCapabilities().supported
  const iosHomeScreenRequired = pushCapabilities().iosHomeScreenRequired
  const canReceiveUploads = role !== 'intern'

  const refreshDevices = async () => {
    const response = await fetch('/api/push/subscriptions', { cache: 'no-store', credentials: 'same-origin' })
    const payload = await response.json() as { devices?: PushDevice[]; error?: string }
    if (!response.ok) throw new Error(payload.error || 'Unable to load your devices.')
    setDevices(payload.devices || [])
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      const [preferenceResult, profileResult] = await Promise.all([
        supabase.from('user_preferences').select('notifications_enabled, dark_mode, email_digest').eq('profile_id', userId).maybeSingle(),
        supabase.from('profiles').select('role').eq('id', userId).single(),
      ])
      if (preferenceResult.error || profileResult.error || !profileResult.data) {
        throw new Error('Unable to load your notification settings.')
      }
      if (!active) return
      setPreferences(preferenceResult.data || { notifications_enabled: true, dark_mode: false, email_digest: false })
      const savedSettings = await loadOrCreateNotificationSettings(supabase, userId, profileResult.data.role)
      if (!active) return
      setSettings({
        ...savedSettings,
        quiet_start: savedSettings.quiet_start.slice(0, 5),
        quiet_end: savedSettings.quiet_end.slice(0, 5),
      })
      if (!supported) setPermission('Not available in this browser')
      else if (Notification.permission === 'denied') setPermission('Blocked in browser settings')
      else if (Notification.permission === 'granted') setPermission('Permission granted')
      else setPermission('Permission not requested')

      await refreshDevices()
      if (!active || !supported || Notification.permission !== 'granted') return
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      if (!subscription) return
      const responseId = await savePushSubscription(subscription)
      if (active) {
        setCurrentDeviceId(responseId)
        await refreshDevices()
      }
    }
    void load().catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to load your notification settings.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [supabase, userId, supported])

  async function saveSetting(patch: Partial<SettingsRecord>) {
    if (!settings) return
    const previous = settings
    const next = { ...settings, ...patch }
    setSettings(next)
    setSaving(true)
    setMessage('')
    setError('')
    const { error: updateError } = await supabase
      .from('notification_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (updateError) {
      setSettings(previous)
      setError('Your notification setting could not be saved. Please try again.')
    } else setMessage('Notification setting saved.')
    setSaving(false)
  }

  async function saveInApp(enabled: boolean) {
    setSaving(true)
    setMessage('')
    setError('')
    const next = { ...preferences, notifications_enabled: enabled }
    setPreferences(next)
    const { error: updateError } = await supabase
      .from('user_preferences')
      .upsert({ profile_id: userId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' })
    if (updateError) {
      setPreferences(preferences)
      setError('Your in-app notification setting could not be saved.')
    } else setMessage('In-app notification setting saved.')
    setSaving(false)
  }

  async function togglePush(enabled: boolean) {
    setError('')
    setMessage('')
    setSaving(true)
    try {
      if (enabled) {
        const result = await enablePushNotifications()
        setCurrentDeviceId(result.id)
        setPermission('Permission granted')
      } else {
        await removePushSubscription(currentDeviceId || undefined, true)
        setCurrentDeviceId('')
        setMessage('Notifications are off on this device.')
      }
      await refreshDevices()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This device setting could not be changed.')
    } finally {
      setSaving(false)
    }
  }

  async function removeDevice(device: PushDevice) {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await removePushSubscription(device.id, device.id === currentDeviceId)
      setDevices((current) => current.filter((item) => item.id !== device.id))
      if (device.id === currentDeviceId) setCurrentDeviceId('')
      setMessage('Device removed.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This device could not be removed.')
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/push/test', { method: 'POST', credentials: 'same-origin' })
      const payload = await response.json() as { sent?: number; error?: string }
      if (!response.ok) throw new Error(payload.error || 'The test notification could not be sent.')
      setMessage('Test notification sent to your registered device.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The test notification could not be sent.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <section className="card" aria-live="polite">Loading notification settings…</section>

  const isPushEnabled = Boolean(currentDeviceId)
  return <div className="space-y-5">
    {(error || message) && <p role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-[#B84C1A]/30 bg-[#B84C1A]/10 text-[#8B3514]' : 'border-[#782653]/20 bg-[#EFE3E7] text-[#782653]'}`}>{error || message}</p>}
    <section className="card">
      <SectionTitle title="Device notifications" description="Choose which alerts this account receives, then enable push separately on each device." />
      <div className="divide-y divide-[#DCCFD6]">
        <SwitchRow title="Notifications on this device" description={`Current browser permission: ${permission}. Turning this off removes this device subscription.`} checked={isPushEnabled} disabled={saving || (!supported && !iosHomeScreenRequired)} onChange={(checked) => void togglePush(checked)} />
        {iosHomeScreenRequired && <p className="py-4 text-sm leading-6 text-[#6E646A]">On iPhone or iPad, tap Share, choose Add to Home Screen, then open NK Udada Staff Hub from your Home Screen. Push requires iOS 16.4 or later.</p>}
        <SwitchRow title="In-app notifications" description="Master switch for alerts in the Hub bell. This does not change device push permission." checked={preferences.notifications_enabled} disabled={saving} onChange={(checked) => void saveInApp(checked)} />
        <SwitchRow title="Comments on my documents" description="Alert me when someone comments on a document I own or have commented on." checked={settings?.comments_enabled ?? true} disabled={saving} onChange={(checked) => void saveSetting({ comments_enabled: checked })} />
        <SwitchRow title="Tasks assigned to me" description="Alert me when a task is assigned to my account." checked={settings?.assignments_enabled ?? true} disabled={saving} onChange={(checked) => void saveSetting({ assignments_enabled: checked })} />
        {canReceiveUploads && <SwitchRow title="New documents uploaded" description="Alert me about uploads I am allowed to view." checked={settings?.uploads_enabled ?? false} disabled={saving} onChange={(checked) => void saveSetting({ uploads_enabled: checked })} />}
        <SwitchRow title="Quiet hours" description="Push is held between 21:00 and 07:00 Africa/Kampala. In-app alerts remain available." checked={settings?.quiet_hours_enabled ?? true} disabled={saving} onChange={(checked) => void saveSetting({ quiet_hours_enabled: checked })} />
      </div>
    </section>

    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle title="My devices" description="Push subscriptions registered to your Staff Hub account." />
        <button type="button" onClick={() => void sendTest()} disabled={saving || !isPushEnabled} className="min-h-11 rounded-lg border border-[#782653] px-4 py-2 text-sm font-semibold text-[#782653] hover:bg-[#EFE3E7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EA519D] disabled:opacity-50">Send a test notification</button>
      </div>
      <ul className="divide-y divide-[#DCCFD6]">
        {devices.map((device) => <li key={device.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <Smartphone size={19} className="mt-0.5 shrink-0 text-[#782653]" aria-hidden="true" />
            <div><p className="font-semibold text-[#241820]">{device.device_label}{device.id === currentDeviceId ? ' · This device' : ''}</p><p className="mt-1 text-xs text-[#6E646A]">Last used {formatUsed(device.last_seen_at)}</p></div>
          </div>
          <button type="button" onClick={() => void removeDevice(device)} disabled={saving} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-[#B84C1A] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EA519D] disabled:opacity-50">Remove</button>
        </li>)}
      </ul>
      {devices.length === 0 && <p className="py-4 text-sm text-[#6E646A]">No push-enabled devices are registered.</p>}
      <p className="mt-4 rounded-lg bg-[#EFE3E7] p-4 text-sm leading-6 text-[#392F35]">We store a device identifier needed to send alerts and the browser name. You can remove a device here or switch off notifications on that device. Notification previews do not contain private message content. The Data Protection Officer should review this wording before launch.</p>
    </section>
  </div>
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div className="mb-5 flex items-start gap-3">
    <span className="rounded-lg bg-[#EFE3E7] p-2 text-[#782653]"><Bell size={18} aria-hidden="true" /></span>
    <div><h2 className="font-bold text-[#241820]">{title}</h2><p className="mt-1 text-sm leading-5 text-[#6E646A]">{description}</p></div>
  </div>
}

function SwitchRow({ title, description, checked, disabled, onChange }: { title: string; description: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
    <div><p className="font-semibold text-[#241820]">{title}</p><p className="mt-1 text-sm leading-5 text-[#6E646A]">{description}</p></div>
    <button type="button" role="switch" aria-checked={checked} aria-label={title} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-8 w-14 shrink-0 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EA519D] disabled:opacity-50 ${checked ? 'bg-[#782653]' : 'bg-[#A8959F]'}`}><span aria-hidden="true" className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-transform ${checked ? 'translate-x-7' : 'translate-x-1'}`} /></button>
  </div>
}
