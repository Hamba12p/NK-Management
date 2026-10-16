import { adminClient, addWeeks, normaliseEmail, parseArgs, requireIntern } from './lib/intern-admin.mjs'

const args = parseArgs(['email', 'weeks'])
const email = normaliseEmail(args.email)
const weeks = Number(args.weeks || 2)
if (!Number.isInteger(weeks) || weeks < 1 || weeks > 2) throw new Error('--weeks must be 1 or 2.')
const supabase = adminClient()
const { profile } = await requireIntern(supabase, email)
if (!profile.access_expires_at) throw new Error('The intern profile has no expiry date. Resolve it manually before extending.')
const expiry = addWeeks(profile.access_expires_at.slice(0, 10), weeks)
console.log(`Dry run: extend ${profile.full_name} (${email}) from ${profile.access_expires_at} to ${expiry}.`)
if (!args.apply) {
  console.log('No changes made. Add --apply to update the expiry date.')
  process.exit(0)
}
const { error } = await supabase.from('profiles').update({ access_expires_at: expiry, updated_at: new Date().toISOString() }).eq('id', profile.id)
if (error) throw new Error(`Expiry update failed: ${error.message}`)
console.log(`Expiry updated to ${expiry}.`)
