import { randomBytes } from 'node:crypto'
import { adminClient, addWeeks, authUserForEmail, normaliseEmail, parseArgs, profileForEmail } from './lib/intern-admin.mjs'

const args = parseArgs(['email', 'name', 'start', 'weeks'])
const email = normaliseEmail(args.email)
const name = String(args.name || '').trim()
const start = String(args.start || '')
const weeks = Number(args.weeks || 4)
if (name.length < 2 || name.length > 100) throw new Error('Provide a --name between 2 and 100 characters.')
if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Number.isNaN(Date.parse(`${start}T00:00:00Z`))) throw new Error('--start must use YYYY-MM-DD.')
if (![4, 5, 6].includes(weeks)) throw new Error('--weeks must be 4, 5 or 6.')

const supabase = adminClient()
const { error: schemaError } = await supabase.from('profiles')
  .select('id,email,role,access_expires_at,must_change_password').limit(1)
if (schemaError) throw new Error(`Intern access migrations are not ready: ${schemaError.message}`)

const [existingUser, existingProfile] = await Promise.all([
  authUserForEmail(supabase, email),
  profileForEmail(supabase, email),
])
if (existingUser || existingProfile) throw new Error('That email already belongs to an account. No account was changed.')

const expires = addWeeks(start, weeks)
console.log(`Dry run: create intern ${name} (${email}) starting ${start}, expiry ${expires}.`)
if (!args.apply) {
  console.log('No changes made. Add --apply to create the account.')
  process.exit(0)
}

const temporaryPassword = randomBytes(32).toString('base64url')
const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email, password: temporaryPassword, email_confirm: false,
  user_metadata: { full_name: name, role: 'intern', account_type: 'person' },
})
if (createError || !created.user) throw new Error(`Auth user creation failed: ${createError?.message || 'No user returned'}`)

const { error: profileError } = await supabase.from('profiles').upsert({
  id: created.user.id, full_name: name, email, role: 'intern',
  account_type: 'person', display_tag: name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase().slice(0, 4),
  access_expires_at: expires, must_change_password: true, updated_at: new Date().toISOString(),
}, { onConflict: 'id' })
if (profileError) {
  await supabase.auth.admin.deleteUser(created.user.id)
  throw new Error(`Profile creation failed; the newly-created Auth user was rolled back: ${profileError.message}`)
}

console.log(`Created intern account ${email}; expires ${expires}.`)
console.log(`Temporary password (shown once): ${temporaryPassword}`)
console.log('Pass the temporary password to Amina through a secure channel.')
