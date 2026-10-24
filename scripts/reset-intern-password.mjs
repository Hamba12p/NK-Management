import { randomBytes } from 'node:crypto'
import { adminClient, authUserForEmail, normaliseEmail, parseArgs, profileForEmail } from './lib/intern-admin.mjs'

const args = parseArgs(['email', 'show-password'])
const email = normaliseEmail(args.email)
const client = adminClient()
const [profile, user] = await Promise.all([
  profileForEmail(client, email),
  authUserForEmail(client, email),
])
if (!profile || profile.role !== 'intern' || !user || profile.id !== user.id) {
  throw new Error('No matching intern profile and Auth user were found. No account was changed.')
}
if (!profile.access_starts_on || !profile.access_expires_at || Date.parse(profile.access_expires_at) <= Date.now()) {
  throw new Error('The intern profile is missing a start date or has expired. No account was changed.')
}
console.log(`Dry run: reset the temporary password for ${email}; access starts ${profile.access_starts_on}.`)
if (!args.apply) {
  console.log('No changes made. Add --apply to reset the password.')
} else {
  const temporaryPassword = randomBytes(32).toString('base64url')
  const { error } = await client.auth.admin.updateUserById(user.id, { password: temporaryPassword })
  if (error) throw new Error(`Password reset failed: ${error.message}`)
  const { error: profileError } = await client.from('profiles')
    .update({ must_change_password: true, updated_at: new Date().toISOString() }).eq('id', user.id)
  if (profileError) throw new Error(`Password changed but the forced-change flag could not be set: ${profileError.message}`)
  console.log(`Temporary password reset for ${email}.`)
  if (args.showPassword) console.log(`Temporary password (shown once): ${temporaryPassword}`)
  else console.log('The generated password was not displayed. Run with --show-password from a secure operations shell to retrieve it once.')
}
