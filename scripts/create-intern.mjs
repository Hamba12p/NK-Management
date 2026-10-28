import { randomBytes } from 'node:crypto'
import { adminClient, addMonths, addWeeks, authUserForEmail, normaliseEmail, parseArgs, profileForEmail } from './lib/intern-admin.mjs'

const args = parseArgs(['email', 'name', 'start', 'weeks', 'months', 'show-password', 'no-expiry', 'password-change-on', 'use-env-password'])
const email = normaliseEmail(args.email)
const name = String(args.name || '').trim()
const start = String(args.start || '')
const weeks = args.weeks === undefined ? 4 : Number(args.weeks)
const months = args.months === undefined ? null : Number(args.months)
const noExpiry = Boolean(args.noExpiry)
const passwordChangeOn = String(args.passwordChangeOn || start)
if (name.length < 2 || name.length > 100) throw new Error('Provide a --name between 2 and 100 characters.')
if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Number.isNaN(Date.parse(`${start}T00:00:00Z`))) throw new Error('--start must use YYYY-MM-DD.')
if (!/^\d{4}-\d{2}-\d{2}$/.test(passwordChangeOn) || Number.isNaN(Date.parse(`${passwordChangeOn}T00:00:00Z`))) throw new Error('--password-change-on must use YYYY-MM-DD.')
if (args.weeks !== undefined && args.months !== undefined) throw new Error('Use either --weeks or --months, not both.')
if (noExpiry && (args.weeks !== undefined || args.months !== undefined)) throw new Error('Use --no-expiry without --weeks or --months.')
if (months !== null && (!Number.isInteger(months) || months < 1 || months > 12)) throw new Error('--months must be a whole number from 1 to 12.')
if (months === null && ![4, 5, 6].includes(weeks)) throw new Error('--weeks must be 4, 5 or 6.')
if (passwordChangeOn < start) throw new Error('--password-change-on cannot be before --start.')

const supabase = adminClient()
const { error: schemaError } = await supabase.from('profiles')
  .select('id,email,role,access_starts_on,access_expires_at,intern_access_enabled,must_change_password,password_change_required_on').limit(1)
if (schemaError) throw new Error(`Intern access migrations are not ready: ${schemaError.message}`)

const [existingUser, existingProfile] = await Promise.all([
  authUserForEmail(supabase, email),
  profileForEmail(supabase, email),
])
if (existingUser || existingProfile) throw new Error('That email already belongs to an account. No account was changed.')

const expires = noExpiry ? null : months === null ? addWeeks(start, weeks) : addMonths(start, months)
console.log(`Dry run: create intern ${name} (${email}) access starts ${start}, password change required ${passwordChangeOn}, expiry ${expires || 'manual admin toggle'}.`)
if (!args.apply) {
  console.log('No changes made. Add --apply to create the account.')
} else {
  const configuredPassword = args.useEnvPassword ? process.env.REGES_TEMP_PASSWORD : undefined
  if (args.useEnvPassword && (!configuredPassword || configuredPassword.length < 12 || configuredPassword.length > 128)) {
    throw new Error('Set REGES_TEMP_PASSWORD to a password between 12 and 128 characters before using --use-env-password.')
  }
  const temporaryPassword = configuredPassword || randomBytes(32).toString('base64url')
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email, password: temporaryPassword, email_confirm: true,
    user_metadata: { full_name: name, role: 'intern', account_type: 'person' },
  })
  if (createError || !created.user) throw new Error(`Auth user creation failed: ${createError?.message || 'No user returned'}`)

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: created.user.id, full_name: name, email, role: 'intern',
    account_type: 'person', display_tag: name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase().slice(0, 4),
    access_starts_on: start, access_expires_at: expires, intern_access_enabled: true,
    must_change_password: true, password_change_required_on: passwordChangeOn,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (profileError) {
    await supabase.auth.admin.deleteUser(created.user.id)
    throw new Error(`Profile creation failed; the newly-created Auth user was rolled back: ${profileError.message}`)
  }

  console.log(`Created intern account ${email}; ${expires ? `expires ${expires}` : 'access ends when an administrator disables it'}.`)
  if (args.showPassword) console.log(`Temporary password (shown once): ${temporaryPassword}`)
  else console.log('The temporary password was not displayed. Deliver it through the approved secure channel.')
}
