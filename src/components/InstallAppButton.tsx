'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean(navigator.standalone))
  )
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function InstallAppButton() {
  const [status, setStatus] = useState<'install' | 'ios' | 'hidden' | null>(null)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    let promptCaptured = false
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      promptCaptured = true
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setStatus('install')
    }
    const handleAppInstalled = () => {
      setInstallPrompt(null)
      setStatus('hidden')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    const timer = window.setTimeout(() => {
      if (isStandalone()) {
        setStatus('hidden')
      } else if (isIos()) {
        setStatus('ios')
      } else if (!promptCaptured) {
        setStatus('hidden')
      } else {
        setStatus('install')
      }
    }, 0)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  if (status === null || status === 'hidden') return null

  if (status === 'ios') {
    return (
      <p className="mt-4 text-center text-xs text-muted">
        To install, tap the Share icon, then <span className="font-semibold">Add to Home Screen</span>.
      </p>
    )
  }

  return (
    <button type="button" onClick={handleInstall} className="btn-secondary mt-4 w-full text-sm">
      Install Staff Hub
    </button>
  )
}
