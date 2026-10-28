'use client'

import { useEffect, useState } from 'react'

export default function PushCleanupNotice({ serverCleanupFailed }: { serverCleanupFailed: boolean }) {
  const [status, setStatus] = useState<'cleaning' | 'complete' | 'failed'>('cleaning')

  useEffect(() => {
    let active = true
    const cleanup = async () => {
      if (!('serviceWorker' in navigator)) {
        if (active) setStatus('complete')
        return
      }
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      const removed = subscription ? await subscription.unsubscribe() : true
      if (!removed) throw new Error('Browser did not confirm the subscription was removed')
      if (active) setStatus('complete')
    }
    void cleanup().catch(() => {
      if (active) setStatus('failed')
    })
    return () => { active = false }
  }, [])

  if (status === 'cleaning') return <p role="status" className="mt-4 text-sm text-muted">Switching off device notifications…</p>
  if (status === 'failed' || serverCleanupFailed) {
    return <p role="alert" className="mt-4 text-sm text-rust">
      This browser subscription could not be fully confirmed as removed. Please contact your supervisor so they can check device notifications.
    </p>
  }
  return <p role="status" className="mt-4 text-sm text-muted">Device notifications have been switched off.</p>
}
