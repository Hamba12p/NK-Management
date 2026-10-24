'use client'

import { useState } from 'react'

type Person = { id: string; volunteer_number: string; full_name: string; email: string | null; phone: string | null; status: string; is_founding: boolean }

export default function RosterControls({ initialRoster, canReset }: { initialRoster: Person[]; canReset: boolean }) {
  const [roster, setRoster] = useState(initialRoster)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [csv, setCsv] = useState('')
  const [busy, setBusy] = useState(false)

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/onboarding/roster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName, email, phone }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setRoster((items) => [...items, result.volunteer].sort((a, b) => a.volunteer_number.localeCompare(b.volunteer_number)))
      setFullName(''); setEmail(''); setPhone(''); setMessage(`${result.volunteer.volunteer_number} added to the roster.`)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'The volunteer could not be added.') }
    finally { setBusy(false) }
  }

  async function update(person: Person, changes: Record<string, unknown>) {
    const response = await fetch('/api/onboarding/roster', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: person.id, ...changes }) })
    const result = await response.json()
    if (!response.ok) { setMessage(result.error); return }
    setRoster((items) => items.map((item) => item.id === person.id ? { ...item, ...changes, status: typeof changes.status === 'string' ? changes.status : item.status, is_founding: typeof changes.isFounding === 'boolean' ? changes.isFounding : item.is_founding } : item))
  }

  async function invite(person: Person) {
    const text = `Welcome to NK Udada! Start Your Udada Passport here: ${window.location.origin}/obx. Your volunteer number is ${person.volunteer_number}. It takes about 20 minutes, and you can pause any time.`
    try { await navigator.clipboard.writeText(text); setMessage(`Invite message copied for ${person.volunteer_number}.`) }
    catch { setMessage(text) }
  }

  async function importCsv() {
    if (!csv.trim()) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/onboarding/roster', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: csv })
      const result = await response.json()
      if (!response.ok && response.status !== 207) throw new Error(result.error)
      setRoster((items) => [...items, ...(result.imported || [])])
      setCsv('')
      setMessage(`${result.imported?.length || 0} row(s) imported${result.errors?.length ? `. ${result.errors.join(' ')}` : '.'}`)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'The CSV could not be imported.') }
    finally { setBusy(false) }
  }

  async function reset(person: Person) {
    if (!window.confirm(`Start a fresh onboarding cycle for ${person.volunteer_number}? Their earlier answers and progress will be kept.`)) return
    const response = await fetch('/api/onboarding/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rosterId: person.id }) })
    const result = await response.json()
    setMessage(response.ok ? `A new cycle has been started for ${person.volunteer_number}.` : result.error)
  }

  return <>
    <form onSubmit={add} className="card grid gap-3 md:grid-cols-4 md:items-end">
      <div><p className="text-xs font-bold uppercase tracking-wider text-purple">Add a volunteer</p><p className="mt-1 text-sm text-muted">A random NKV number from 100 upward will be assigned.</p><label className="mt-3 block text-sm font-semibold">Full name<input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 w-full px-3 py-2" /></label></div>
      <label className="block text-sm font-semibold">Email<input required={!phone} type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full px-3 py-2" /></label>
      <label className="block text-sm font-semibold">Phone<input required={!email} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+256…" className="mt-2 w-full px-3 py-2" /></label>
      <button disabled={busy} className="btn-primary">{busy ? 'Adding…' : 'Add to roster'}</button>
      {message && <p role="status" aria-live="polite" className="text-sm text-muted md:col-span-4">{message}</p>}
    </form>
    <section className="table-surface"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Volunteer</th><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Status</th><th className="p-3">Founding</th><th className="p-3">Actions</th></tr></thead><tbody>{roster.map((person) => <tr key={person.id} className="border-t border-border"><td className="p-3"><b>{person.volunteer_number}</b><br />{person.full_name}</td><td className="p-3">{person.email}</td><td className="p-3">{person.phone || '—'}</td><td className="p-3 capitalize">{person.status}</td><td className="p-3"><button className="rounded border px-3 py-2" onClick={() => update(person, { isFounding: !person.is_founding })} aria-pressed={person.is_founding}>{person.is_founding ? 'Founding volunteer' : 'Not founding'}</button></td><td className="p-3"><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => invite(person)}>Copy invite</button>{person.status === 'active' && <button className="btn-secondary" onClick={() => update(person, { status: 'inactive' })}>Deactivate</button>}{canReset && <button className="btn-secondary" onClick={() => reset(person)}>Reset</button>}</div></td></tr>)}</tbody></table>{!roster.length && <p className="p-8 text-center text-muted">The roster is empty.</p>}</section>
    <section className="card"><h2 className="font-semibold text-ink">Import existing volunteers</h2><p className="mt-1 text-sm text-muted">Paste CSV with Name (or Full name) and at least one Email or Phone column. Volunteer numbers are randomly assigned when omitted. The No. column is ignored.</p><textarea value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="No.,Name,Phone,Email" className="mt-3 min-h-28 w-full p-3 font-mono text-sm" /><button disabled={busy || !csv.trim()} onClick={importCsv} className="btn-secondary mt-3">Import CSV</button></section>
  </>
}
