import { randomBytes } from 'node:crypto'
import { adminClient, authUserForEmail, normaliseEmail, parseArgs, profileForEmail } from './lib/intern-admin.mjs'

const args = parseArgs(['email', 'show-password', 'use-env-password', 'access-start', 'password-change-on', 'no-expiry'])
const email = normaliseEmail(args.email)
const client = adminClient()
const [profile, user] = await Promise.all([
  profileForEmail(client, email),
  authUserForEmail(client, email),
])
if (!profile || profile.role !== 'intern' || !user || profile.id !== user.id) {
  throw new Error('No matching intern profile and Auth user were found. No account was changed.')
}
const accessStart = String(args.accessStart || profile.access_starts_on || '')
const passwordChangeOn = String(args.passwordChangeOn || '')
const noExpiry = Boolean(args.noExpiry)
if (!/^\d{4}-\d{2}-\d{2}$/.test(accessStart) || Number.isNaN(Date.parse(`${accessStart}T00:00:00Z`))) {
  throw new Error('Provide --access-start YYYY-MM-DD or resolve the profile start date. No account was changed.')
}
if (passwordChangeOn && (!/^\d{4}-\d{2}-\d{2}$/.test(passwordChangeOn) || Number.isNaN(Date.parse(`${passwordChangeOn}T00:00:00Z`)))) {
  throw new Error('--password-change-on must use YYYY-MM-DD. No account was changed.')
}
if (passwordChangeOn && passwordChangeOn < accessStart) {
  throw new Error('--password-change-on cannot be before --access-start. No account was changed.')
}
if (!noExpiry && (!profile.access_expires_at || Date.parse(profile.access_expires_at) <= Date.now())) {
  throw new Error('The intern profile is missing a start date or has expired. No account was changed.')
}
const expires = noExpiry ? null : profile.access_expires_at
console.log(`Dry run: confirm the email and reset the temporary password for ${email}; access starts ${accessStart}, password change required ${passwordChangeOn || 'immediately'}, expiry ${expires || 'manual admin toggle'}.`)
if (!args.apply) {
  console.log('No changes made. Add --apply to reset the password.')
} else {
  const configuredPassword = args.useEnvPassword ? process.env.REGES_TEMP_PASSWORD : undefined
  if (args.useEnvPassword && (!configuredPassword || configuredPassword.length < 12 || configuredPassword.length > 128)) {
    throw new Error('Set REGES_TEMP_PASSWORD to a password between 12 and 128 characters before using --use-env-password.')
  }
  const temporaryPassword = configuredPassword || randomBytes(32).toString('base64url')
  const profileUpdate = {
    must_change_password: true,
    password_change_required_on: passwordChangeOn || null,
    updated_at: new Date().toISOString(),
  }
  if (args.accessStart) {
    profileUpdate.access_starts_on = accessStart
    profileUpdate.intern_access_enabled = true
  }
  if (noExpiry) profileUpdate.access_expires_at = null
  const { error: profileError } = await client.from('profiles').update(profileUpdate).eq('id', user.id)
  if (profileError) throw new Error(`Password reset was not attempted because the access profile could not be updated: ${profileError.message}`)
  const { error: passwordError } = await client.auth.admin.updateUserById(user.id, {
    password: temporaryPassword,
    email_confirm: true,
  })
  if (passwordError) {
    const { error: rollbackError } = await client.from('profiles').update({
      access_starts_on: profile.access_starts_on,
      access_expires_at: profile.access_expires_at,
      intern_access_enabled: profile.intern_access_enabled,
      must_change_password: profile.must_change_password,
      password_change_required_on: profile.password_change_required_on,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)
    if (rollbackError) throw new Error(`Password reset failed (${passwordError.message}) and the access profile rollback also failed (${rollbackError.message}).`)
    throw new Error(`Password reset failed; the access profile change was rolled back: ${passwordError.message}`)
  }
  console.log(`Temporary password reset for ${email}.`)
  if (args.showPassword) console.log(`Temporary password (shown once): ${temporaryPassword}`)
  else console.log('The generated password was not displayed. Run with --show-password from a secure operations shell to retrieve it once.')
}
