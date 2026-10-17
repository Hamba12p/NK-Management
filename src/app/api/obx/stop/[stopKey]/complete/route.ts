import { NextRequest, NextResponse } from 'next/server'
import { getObxRoster, originAllowed, unavailable } from '@/lib/obx/http'
import { obxStops } from '@/content/obx/en/stops'
import { OBX_CONFIG } from '@/content/obx/config'
import { meetsPassMark, scorePercent } from '@/lib/obx/logic'

export async function POST(request: NextRequest, context: { params: Promise<{ stopKey: string }> }) {
  if (!originAllowed(request)) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 403 })
  try {
    const session = await getObxRoster()
    if (!session) return NextResponse.json({ error: 'Please sign in again to continue your passport.' }, { status: 401 })
    const { stopKey } = await context.params
    const stop = obxStops.find((item) => item.id === stopKey)
    if (!stop) return NextResponse.json({ error: 'That stop could not be found.' }, { status: 404 })
    const { admin, roster } = session
    const { data: progress, error: progressError } = await admin.from('obx_progress').select('cycle, current_stop').eq('roster_id', roster.id).order('cycle', { ascending: false }).limit(1).single()
    if (progressError || !progress) return unavailable()
    if (progress.current_stop !== stopKey) return NextResponse.json({ error: 'Complete the current stop first.' }, { status: 409 })
    const { data: answers, error } = await admin.from('obx_answers').select('question_key, attempt_no, correct').eq('roster_id', roster.id).eq('cycle', progress.cycle).eq('stop_key', stopKey).order('attempt_no')
    if (error) return unavailable()
    const firstAnswers = new Map<string, boolean>()
    const latestAnswers = new Map<string, boolean>()
    for (const answer of answers || []) {
      if (!firstAnswers.has(answer.question_key)) firstAnswers.set(answer.question_key, answer.correct)
      latestAnswers.set(answer.question_key, answer.correct)
    }
    if (stop.questions.some((question) => !firstAnswers.has(question.id))) return NextResponse.json({ error: 'Finish each activity before stamping this stop.' }, { status: 409 })
    const correct = [...firstAnswers.values()].filter(Boolean).length
    const firstTryScore = stop.questions.length ? scorePercent(correct, stop.questions.length) : null
    const passed = stop.id !== 'keeping_children_safe' || meetsPassMark(Number(firstTryScore), OBX_CONFIG.passMarks.keepingChildrenSafe) || stop.questions.every((question) => latestAnswers.get(question.id) === true)
    const { data: existing } = await admin.from('obx_stop_results').select('attempts, best_score').eq('roster_id', roster.id).eq('cycle', progress.cycle).eq('stop_key', stopKey).maybeSingle()
    const now = new Date().toISOString()
    const { error: saveError } = await admin.from('obx_stop_results').upsert({ roster_id: roster.id, cycle: progress.cycle, stop_key: stopKey, attempts: (existing?.attempts || 0) + 1, first_try_score: firstTryScore, best_score: Math.max(Number(existing?.best_score || 0), Number(firstTryScore || 0)), passed, completed_at: passed ? now : null }, { onConflict: 'roster_id,cycle,stop_key' })
    if (saveError) return unavailable()
    const next = passed ? obxStops[obxStops.findIndex((item) => item.id === stopKey) + 1] : stop
    const { error: updateError } = await admin.from('obx_progress').update({ current_stop: next?.id || stop.id, current_question: null, last_active_at: now }).eq('roster_id', roster.id).eq('cycle', progress.cycle)
    if (updateError) return unavailable()
    return NextResponse.json({ passed, firstTryScore, nextStop: next?.id || null, attempts: (existing?.attempts || 0) + 1 })
  } catch { return unavailable() }
}
