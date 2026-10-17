import { NextRequest, NextResponse } from 'next/server'
import { getObxRoster, originAllowed, unavailable } from '@/lib/obx/http'
import { answerKey } from '@/lib/obx/answer-key'
import { obxStops } from '@/content/obx/en/stops'

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 403 })
  try {
    const session = await getObxRoster()
    if (!session) return NextResponse.json({ error: 'Please sign in again to continue your passport.' }, { status: 401 })
    const body = await request.json()
    const { stopKey, questionKey, choiceKey, requestId } = body as { stopKey?: string; questionKey?: string; choiceKey?: string; requestId?: string }
    const stop = obxStops.find((item) => item.id === stopKey)
    const question = stop?.questions.find((item) => item.id === questionKey)
    const key = stopKey && questionKey ? answerKey[stopKey]?.[questionKey] : undefined
    if (!stop || !question || !key || !question.choices.some((item) => item.id === choiceKey) || !requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) return NextResponse.json({ error: 'That answer could not be saved.' }, { status: 400 })
    const { admin, roster } = session
    const { data: progress, error: progressError } = await admin.from('obx_progress').select('cycle, status, current_stop').eq('roster_id', roster.id).order('cycle', { ascending: false }).limit(1).single()
    if (progressError || !progress || progress.status === 'completed') return NextResponse.json({ error: 'This passport is already complete.' }, { status: 409 })
    if (progress.current_stop !== stopKey) return NextResponse.json({ error: 'Pick up at your current stop to continue.' }, { status: 409 })
    const { data: prior, error: priorError } = await admin.from('obx_answers').select('choice_key, correct, attempt_no, question_key, stop_key').eq('roster_id', roster.id).eq('cycle', progress.cycle).eq('request_id', requestId).maybeSingle()
    if (priorError) return unavailable()
    if (prior) {
      if (prior.choice_key !== choiceKey || prior.question_key !== questionKey || prior.stop_key !== stopKey) return NextResponse.json({ error: 'That answer could not be saved.' }, { status: 409 })
      return NextResponse.json({ correct: prior.correct, explanation: key.explanation, attemptNo: prior.attempt_no })
    }
    const { count, error: countError } = await admin.from('obx_answers').select('id', { count: 'exact', head: true }).eq('roster_id', roster.id).eq('cycle', progress.cycle).eq('stop_key', stopKey).eq('question_key', questionKey)
    if (countError) return unavailable()
    const attemptNo = (count || 0) + 1
    const correct = choiceKey === key.correct
    const now = new Date().toISOString()
    const { error: insertError } = await admin.from('obx_answers').insert({ roster_id: roster.id, cycle: progress.cycle, stop_key: stopKey, question_key: questionKey, choice_key: choiceKey, correct, attempt_no: attemptNo, request_id: requestId, answered_at: now })
    if (insertError) {
      const { data: duplicate } = await admin.from('obx_answers').select('choice_key, correct, attempt_no, question_key, stop_key').eq('roster_id', roster.id).eq('cycle', progress.cycle).eq('request_id', requestId).maybeSingle()
      if (!duplicate || duplicate.choice_key !== choiceKey || duplicate.question_key !== questionKey || duplicate.stop_key !== stopKey) return unavailable()
      return NextResponse.json({ correct: duplicate.correct, explanation: key.explanation, attemptNo: duplicate.attempt_no })
    }
    const nextQuestion = stop.questions[stop.questions.findIndex((item) => item.id === questionKey) + 1]
    const { error: updateError } = await admin.from('obx_progress').update({ current_stop: stopKey, current_question: nextQuestion?.id || '__recap__', last_active_at: now }).eq('roster_id', roster.id).eq('cycle', progress.cycle)
    if (updateError) return unavailable()
    return NextResponse.json({ correct, explanation: key.explanation, attemptNo })
  } catch {
    return unavailable()
  }
}
