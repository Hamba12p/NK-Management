'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { pushCapabilities, registerNotificationServiceWorker, savePushSubscription } from '@/lib/notifications/client'

export default function NotificationBootstrap() {
  useEffect(() => {
    const supabase = createClient()
    let active = true

    const syncExistingSubscription = async () => {
      const { supported } = pushCapabilities()
      if (!supported || Notification.permission !== 'granted') return
      const registration = await registerNotificationServiceWorker()
      const subscription = await registration.pushManager.getSubscription()
      if (subscription && active) await savePushSubscription(subscription)
    }

    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) return syncExistingSubscription()
      return undefined
    }).catch(() => {
      console.error('Existing device notification setup could not be checked.')
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        void syncExistingSubscription().catch(() => {
          console.error('Existing device notification setup could not be refreshed.')
        })
      }
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return null
}
