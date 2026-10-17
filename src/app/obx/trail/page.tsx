'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { meetNkUdadaStory, obxStops } from '@/content/obx/en/stops'
import { OBX_CONFIG } from '@/content/obx/config'
import { OBX_FACTS } from '@/content/obx/config'

type Me = { roster: { full_name: string; volunteer_number: string }; progress: { status: string; current_stop: string; current_question: string | null }; results: { stop_key: string; completed_at: string | null }[] }
type Feedback = { correct: boolean; explanation: string } | null

export default function ObxTrailPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [stopIndex, setStopIndex] = useState(0)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [roleInterest, setRoleInterest] = useState<string[]>([])
  const [firstWeekChecklist, setFirstWeekChecklist] = useState<string[]>([])
  const [hopeText, setHopeText] = useState('')
  const [agree, setAgree] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [requestId, setRequestId] = useState('')
  const [storyIndex, setStoryIndex] = useState(0)
  const stop = obxStops[stopIndex]
  const question = stop?.questions[questionIndex]
  const showStory = stopIndex === 0 && storyIndex < meetNkUdadaStory.length
  const completed = useMemo(() => new Set(me?.results.filter((item) => item.completed_at).map((item) => item.stop_key) || []), [me])

  useEffect(() => {
    fetch('/api/obx/me').then(async (response) => {
      if (response.status === 401) { window.location.assign('/obx'); return null }
      if (!response.ok) throw new Error('Your passport is reconnecting. Please try again.')
      return response.json() as Promise<Me>
    }).then((data) => { if (data) { setMe(data); setStopIndex(Math.max(0, obxStops.findIndex((item) => item.id === data.progress.current_stop))); const found = obxStops.findIndex((item) => item.id === data.progress.current_stop); if (found >= 0 && data.progress.current_question) { const q = data.progress.current_question === '__recap__' ? obxStops[found].questions.length : obxStops[found].questions.findIndex((item) => item.id === data.progress.current_question); if (q >= 0) setQuestionIndex(q) } } }).catch((cause) => setError(cause.message))
  }, [])

  async function submit() {
    if (!question || !selected || feedback) return
    setBusy(true)
    setError('')
    try {
      const idempotencyKey = requestId || crypto.randomUUID()
      setRequestId(idempotencyKey)
      const response = await fetch('/api/obx/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stopKey: stop.id, questionKey: question.id, choiceKey: selected, requestId: idempotencyKey }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Your answer could not be saved. Please try again.')
      setFeedback(result)
      setRequestId('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your progress is reconnecting. Please try again.') }
    finally { setBusy(false) }
  }

  function next() {
    setFeedback(null); setSelected('')
    if (questionIndex < stop.questions.length) setQuestionIndex((value) => value + 1)
    else if (stopIndex < obxStops.length - 1) { setQuestionIndex(0); setStopIndex((value) => value + 1) }
    else window.location.assign('/obx/badge')
  }

  async function finishStop() {
    setBusy(true); setError('')
    try {
      if (stop.id === 'how_we_work') {
        const save = await fetch('/api/obx/stop5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleInterest, hopeText, firstWeekChecklist }) })
        if (!save.ok) throw new Error('Your choices could not be saved. Please try again.')
      }
      const response = await fetch(`/api/obx/stop/${stop.id}/complete`, { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Your stamp could not be saved. Please try again.')
      if (!result.passed) { setError('Almost there. Let’s go through the ones that tripped us up. Please try this stop again.'); setQuestionIndex(0); return }
      if (stopIndex < obxStops.length - 1) { setStopIndex((value) => value + 1); setQuestionIndex(0) }
      else setQuestionIndex(stop.questions.length + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your progress is reconnecting. Please try again.') }
    finally { setBusy(false) }
  }

  async function signOff() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/obx/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ typedName, agree }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Your sign-off could not be saved.')
      window.location.assign('/obx/badge')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your progress is reconnecting. Please try again.') }
    finally { setBusy(false) }
  }

  if (error && !me) return <div className="mx-auto max-w-xl px-4 py-12"><p role="alert" className="rounded bg-[#efe3e7] p-5">{error}</p><Link href="/obx" className="mt-4 inline-block underline">Return to your passport sign-in</Link></div>
  if (!me || !stop) return <div className="mx-auto max-w-xl px-4 py-16 text-center" aria-live="polite">Opening your passport…</div>
  return <div className="mx-auto max-w-3xl px-4 pb-12 pt-5">
    <p className="text-sm font-semibold text-[#782653]">Stop {stopIndex + 1} of 6, about {stop.minutes} minutes</p>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#efe3e7]"><div className="h-full bg-[#ea519d] transition-all" style={{ width: `${(stopIndex / 6) * 100}%` }} /></div>
    <nav aria-label="Passport stops" className="my-7 grid grid-cols-6 gap-2">{obxStops.map((item, index) => <button key={item.id} onClick={() => { if (index <= stopIndex && !me.progress.status.includes('completed')) { setStopIndex(index); setQuestionIndex(0); setFeedback(null); setSelected('') } }} disabled={index > stopIndex || me.progress.status === 'completed'} aria-label={`${item.title}${completed.has(item.id) ? ', complete' : ''}`} className={`aspect-square rounded-full border text-xs font-bold ${index === stopIndex ? 'border-[#ea519d] bg-white ring-4 ring-[#ea519d]/25' : completed.has(item.id) ? 'border-[#782653] bg-[#782653] text-white' : 'border-[#a85d88] bg-white text-[#782653]'}`}>{completed.has(item.id) ? '✓' : index + 1}</button>)}</nav>
    <section className="record-surface p-5 md:p-8">
      <p className="text-sm font-semibold text-[#a85d88]">Your guide, Spark ✦</p>
      <h1 className="serif-display mt-2 text-3xl text-[#782653]">{stop.title}</h1>
      <p className="mt-3 leading-7">{stop.intro}</p>
      {showStory ? <div className="mt-7 rounded-xl bg-white p-6"><p className="text-xs font-bold uppercase tracking-widest text-[#a85d88]">Our story, {storyIndex + 1} of {meetNkUdadaStory.length}</p><p className="serif-display mt-4 text-2xl text-[#782653]">{meetNkUdadaStory[storyIndex]}</p>{storyIndex === 0 && OBX_FACTS.verifyBeforeLaunch && <p className="mt-3 text-xs text-[#6e646a]">Organisation facts need verification before launch.</p>}<button onClick={() => setStoryIndex((value) => value + 1)} className="btn-primary mt-6 w-full">{storyIndex === meetNkUdadaStory.length - 1 ? 'Try a quick question' : 'Next story'}</button></div> : question ? <div className="mt-7"><p className="text-lg font-semibold">{question.prompt}</p><div className="mt-4 grid gap-3">{question.choices.map((choice) => <button key={choice.id} onClick={() => setSelected(choice.id)} disabled={!!feedback} aria-pressed={selected === choice.id} className={`min-h-12 rounded border px-4 py-3 text-left ${selected === choice.id ? 'border-[#782653] bg-[#efe3e7]' : 'border-[#dccfd6] bg-white'}`}>{choice.label}</button>)}</div>
      {feedback && <div role="status" aria-live="polite" className={`mt-4 rounded p-4 ${feedback.correct ? 'bg-[#efe3e7] text-[#782653]' : 'bg-[#b84c1a]/10 text-[#8f3915]'}`}><p className="font-semibold">{feedback.correct ? 'Nice one.' : 'Not quite, here is why.'}</p><p className="mt-1">{feedback.explanation}</p><button onClick={feedback.correct ? next : () => { setFeedback(null); setSelected('') }} className="btn-secondary mt-3">{feedback.correct ? 'Continue' : 'Try again'}</button></div>}
      {!feedback && <button onClick={submit} disabled={!selected || busy} className="btn-primary mt-5 w-full">{busy ? 'Saving your answer…' : 'Check my answer'}</button>}</div> : <div className="mt-7">
      {stop.id === 'how_we_work' && <div className="mb-7 rounded bg-white p-4"><h2 className="font-bold">What would you like to explore?</h2>{['Community Facilitator', 'Curriculum and Training Lead', 'Communities and Impact Volunteer', 'Monitoring and Evaluation Officer', 'Not sure yet'].map((role) => <label key={role} className="mt-3 flex min-h-11 items-center gap-3"><input type="checkbox" checked={roleInterest.includes(role)} onChange={(event) => setRoleInterest((items) => event.target.checked ? [...items, role] : items.filter((item) => item !== role))} />{role}</label>)}<label className="mt-4 block text-sm">One thing I hope to learn or do<textarea maxLength={140} value={hopeText} onChange={(event) => setHopeText(event.target.value)} className="mt-2 w-full p-3" /></label><h3 className="mt-5 font-bold">Your first week</h3>{['Meet your coordinator', 'Attend a briefing', 'Learn the approved safeguarding route', 'Ask where to find the workspace rules'].map((task) => <label key={task} className="mt-2 flex min-h-11 items-center gap-3"><input type="checkbox" checked={firstWeekChecklist.includes(task)} onChange={(event) => setFirstWeekChecklist((items) => event.target.checked ? [...items, task] : items.filter((item) => item !== task))} />{task}</label>)}</div>}
      {stop.id === 'sign_and_celebrate' ? <div className="space-y-4"><h2 className="serif-display text-2xl text-[#782653]">Your promise</h2><div className="space-y-2">{['Treat every person with respect and care.', 'Be reliable and communicate early.', 'Protect children and follow safeguarding steps.', 'Keep personal information private and secure.', 'Declare conflicts and gifts to your coordinator.', 'Raise a concern through the right channel.'].map((item, index) => <details key={item} className="rounded border bg-white p-4"><summary className="cursor-pointer font-semibold">Promise {index + 1}</summary><p className="mt-2 text-sm">{item}</p></details>)}</div>{OBX_CONFIG.fullMouUrl && <a className="text-sm font-semibold text-[#782653] underline" href={OBX_CONFIG.fullMouUrl}>Read the full MOU</a>}<label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />I have read and agree to uphold the NK Udada Organisation MOU and safeguarding rules.</label><label className="block text-sm font-semibold">Type your full name<input value={typedName} onChange={(event) => setTypedName(event.target.value)} className="mt-2 w-full px-4 py-3" /></label>{typedName.trim() && me.roster.full_name.trim().toLocaleLowerCase() !== typedName.trim().toLocaleLowerCase() && <p className="text-sm text-[#6e646a]">Your typed name differs slightly from the roster name. That is fine, you can still continue.</p>}<button disabled={!agree || !typedName.trim() || busy} onClick={signOff} className="btn-primary mt-4 w-full">{busy ? 'Saving your sign-off…' : 'Sign and complete'}</button></div> : <><h2 className="serif-display text-2xl text-[#782653]">Take this with you</h2><ul className="mt-4 list-disc space-y-2 pl-5">{stop.recap.map((point) => <li key={point}>{point}</li>)}</ul>{stop.id === 'keeping_children_safe' && <div className="mt-5 rounded bg-[#efe3e7] p-4"><p className="font-semibold text-[#782653]">Listen, Reassure, Record, Report</p><p className="mt-2 text-sm">Listen calmly. Reassure the learner. Record what was said and seen. Report it to the safeguarding contact the same day.</p></div>}<button onClick={finishStop} disabled={busy} className="btn-primary mt-6 w-full">{busy ? 'Saving your stamp…' : 'Stamp this stop'}</button></>}
      </div>}
    </section>
    {error && <p role="alert" className="mt-4 rounded bg-[#b84c1a]/10 p-3 text-sm text-[#8f3915]">{error}</p>}
    <div className="mt-4 flex justify-between text-sm"><button onClick={() => { if (questionIndex > 0) setQuestionIndex((value) => value - 1); else if (stopIndex > 0) { setStopIndex((value) => value - 1); setQuestionIndex(0) } setFeedback(null); setSelected('') }} className="underline">Back</button><span>{me.roster.full_name}</span></div>
  </div>
}
