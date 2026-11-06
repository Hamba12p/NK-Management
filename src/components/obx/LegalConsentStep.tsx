'use client'

import { useCallback, useRef, useState } from 'react'
import Image from 'next/image'
import {
  LEGAL_VERSION,
  PRIVACY_NOTICE,
  VOLUNTEER_MOU,
  type LegalDocument,
} from '@/lib/obx/legal-content'

type AgreementId = 'privacy' | 'mou'

type Agreement = {
  id: AgreementId
  document: LegalDocument
  label: string
}

const AGREEMENTS: Agreement[] = [
  {
    id: 'privacy',
    document: PRIVACY_NOTICE,
    label: 'I have read and understood how NK Udada looks after my information.',
  },
  {
    id: 'mou',
    document: VOLUNTEER_MOU,
    label: 'I agree to keep the NK Udada volunteer promise.',
  },
]

function documentText(document: LegalDocument) {
  return [
    document.title,
    document.intro,
    ...document.sections.flatMap((section) => [
      section.heading,
      ...(section.paragraphs || []),
      ...(section.bullets || []),
    ]),
  ].join('\n\n')
}

export default function LegalConsentStep({ onAccepted }: { onAccepted: () => void }) {
  const [expanded, setExpanded] = useState<Record<AgreementId, boolean>>({ privacy: false, mou: false })
  const [readToEnd, setReadToEnd] = useState<Record<AgreementId, boolean>>({ privacy: false, mou: false })
  const [accepted, setAccepted] = useState<Record<AgreementId, boolean>>({ privacy: false, mou: false })
  const [progress, setProgress] = useState<Record<AgreementId, number>>({ privacy: 0, mou: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [announced, setAnnounced] = useState(false)
  const reachedEnd = useRef<Record<AgreementId, boolean>>({ privacy: false, mou: false })
  const bothAccepted = accepted.privacy && accepted.mou

  const updateScroll = useCallback((id: AgreementId, element: HTMLDivElement) => {
    const remaining = element.scrollHeight - element.clientHeight - element.scrollTop
    const percentage = element.scrollHeight <= element.clientHeight
      ? 100
      : Math.min(100, Math.max(0, (element.scrollTop / (element.scrollHeight - element.clientHeight)) * 100))
    setProgress((current) => ({ ...current, [id]: percentage }))
    if (remaining <= 3 && !reachedEnd.current[id]) {
      reachedEnd.current[id] = true
      setReadToEnd((current) => ({ ...current, [id]: true }))
    }
  }, [])

  function toggleDocument(id: AgreementId) {
    const opening = !expanded[id]
    setExpanded((current) => ({ ...current, [id]: opening }))
    if (opening) {
      window.requestAnimationFrame(() => {
        const element = document.getElementById(`obx-legal-${id}`)
        if (element instanceof HTMLDivElement) updateScroll(id, element)
      })
    }
  }

  async function copyDocument(document: LegalDocument) {
    try {
      await navigator.clipboard.writeText(documentText(document))
      setCopied(document.title)
    } catch {
      setError('Copy is not available in this browser. You can select the text and copy it instead.')
    }
  }

  async function saveConsent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!bothAccepted || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/obx/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privacyAccepted: accepted.privacy, mouAccepted: accepted.mou, legalVersion: LEGAL_VERSION }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Your agreements could not be saved. Please try again.')
      onAccepted()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your agreements could not be saved. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="obx-consent-prompt mx-auto max-w-3xl px-4 py-6 md:py-10" aria-labelledby="obx-consent-title">
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm md:p-8">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-accent">Before you begin</p>
          <h1 id="obx-consent-title" className="serif-display mt-2 text-3xl text-accent">Two thoughtful promises</h1>
        </div>
        <Image src="/spark-obx/cutouts/spark-encourage.png" alt="" aria-hidden="true" width={189} height={261} className="h-24 w-20 shrink-0 object-contain sm:h-32 sm:w-24" />
      </div>
      <p className="mt-3 leading-7 text-text">Please read both documents and make each promise before starting or continuing your passport.</p>
      <form onSubmit={saveConsent} className="mt-6 space-y-5">
        {AGREEMENTS.map(({ id, document, label }) => (
          <article key={id} className={`obx-consent-card rounded-2xl border p-4 transition-colors duration-300 md:p-5 ${accepted[id] ? 'is-accepted border-pink-accent bg-surface-raised' : 'border-border bg-surface-raised'}`}>
            <button type="button" aria-expanded={expanded[id]} aria-controls={`obx-legal-${id}`} onClick={() => toggleDocument(id)} className="flex min-h-12 w-full items-center justify-between gap-3 text-left font-bold text-accent">
              <span>{document.title}</span><span aria-hidden="true" className="text-xl">{expanded[id] ? '−' : '+'}</span>
            </button>
            <div id={`obx-legal-${id}`} hidden={!expanded[id]} tabIndex={0} aria-label={`${document.title}, scroll to the end to unlock agreement`} onScroll={(event) => updateScroll(id, event.currentTarget)} className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface-raised p-4">
              <p className="font-semibold text-accent">{document.title}</p>
              <p className="mt-2 text-sm leading-6">{document.intro}</p>
              <div className="mt-4 space-y-4">
                {document.sections.map((section) => <section key={section.heading}>
                  <h2 className="font-bold text-accent">{section.heading}</h2>
                  {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-1 text-sm leading-6">{paragraph}</p>)}
                  {section.bullets && <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6">{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
                </section>)}
              </div>
            </div>
            <div hidden={!expanded[id]} className="mt-2 h-1 overflow-hidden rounded-full bg-border-subtle" role="progressbar" aria-label={`${document.title} reading progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress[id])}>
              <div className="h-full bg-pink-accent transition-[width] duration-150" style={{ width: `${progress[id]}%` }} />
            </div>
            <div hidden={!expanded[id]} className="mt-2 flex flex-wrap gap-4 text-sm">
              <button type="button" onClick={() => window.print()} className="font-semibold text-accent underline">Print</button>
              <button type="button" onClick={() => void copyDocument(document)} className="font-semibold text-accent underline">Copy text</button>
              {copied === document.title && <span role="status" className="text-accent">Copied.</span>}
            </div>
            <div className="mt-4 flex items-start gap-3">
              <input id={`obx-agree-${id}`} type="checkbox" checked={accepted[id]} disabled={!readToEnd[id] || busy} aria-describedby={!readToEnd[id] ? `obx-unlock-${id}` : undefined} onChange={(event) => setAccepted((current) => {
                const next = { ...current, [id]: event.target.checked }
                if (next.privacy && next.mou) setAnnounced(true)
                return next
              })} className="peer sr-only" />
              <label htmlFor={`obx-agree-${id}`} className={`obx-consent-choice flex min-h-20 flex-1 cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors     ${accepted[id] ? 'border-accent bg-accent text-accent-text' : 'border-border bg-surface-raised text-text'} ${!readToEnd[id] ? 'cursor-not-allowed' : ''}`}>
                <span aria-hidden="true" className={`obx-checkmark grid h-8 w-8 shrink-0 place-items-center rounded-md border-2 ${accepted[id] ? 'border-accent-text bg-surface-raised' : 'border-accent-hover bg-surface'}`}>
                  <svg viewBox="0 0 24 24" className={`h-6 w-6 ${accepted[id] ? 'is-checked' : ''}`} fill="none">
                    <path d="m5 12 4.5 4.5L19 7" className="obx-checkmark-path" stroke={accepted[id] ? 'var(--accent)' : 'transparent'} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                  </svg>
                </span>
                <span className="font-semibold leading-6">{label}</span>
                {accepted[id] && <span aria-hidden="true" className="obx-consent-seal ml-auto shrink-0 rounded-full border border-accent-text px-3 py-1 text-xs font-bold uppercase tracking-wider">Promise made</span>}
              </label>
            </div>
            {!readToEnd[id] && <p id={`obx-unlock-${id}`} className="mt-2 pl-1 text-sm text-muted">Read to the end to unlock.</p>}
            {readToEnd[id] && accepted[id] && <p className="mt-2 pl-1 text-sm font-semibold text-accent">Thank you, that is one promise made.</p>}
          </article>
        ))}
        {error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        <p className="sr-only" aria-live="polite">{announced && bothAccepted ? 'Both agreements are accepted. Start my onboarding is ready.' : ''}</p>
        <button type="submit" disabled={!bothAccepted || busy} className={`obx-consent-start min-h-14 w-full rounded-xl px-5 py-4 text-lg font-bold text-accent-text transition-colors     ${bothAccepted ? 'bg-accent' : 'cursor-not-allowed bg-surface-muted'}`}>
          {busy ? 'Saving your promises…' : 'Start my onboarding'}
        </button>
        <p className="text-center text-xs text-muted">Document version {LEGAL_VERSION}</p>
      </form>
    </div>
  </section>
}
