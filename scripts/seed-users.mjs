import { createClient } from '@supabase/supabase-js'

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NK_SHARED_INITIAL_PASSWORD', 'NK_MASTER_ADMIN_EMAIL', 'NK_MASTER_ADMIN_PASSWORD']
const missing = required.filter((name) => !process.env[name])
if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
if (process.env.NK_SHARED_INITIAL_PASSWORD === process.env.NK_MASTER_ADMIN_PASSWORD) throw new Error('NK_MASTER_ADMIN_PASSWORD must not match NK_SHARED_INITIAL_PASSWORD')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// Never touch Auth before verifying the remote schema. This prevents partially
// provisioned users when the migration has not yet been applied.
const { error: profilesCheckError } = await supabase.from('profiles').select('id').limit(1)
if (profilesCheckError) {
  if (profilesCheckError.code === 'PGRST205') {
    throw new Error('The Hub schema has not been applied: public.profiles is missing. Apply supabase/migrations/20260811000000_udada_hub.sql in the Supabase SQL Editor, then run this command again.')
  }
  throw new Error(`Cannot verify public.profiles before seeding: ${profilesCheckError.message}`)
}

const roster = [
  ['Naira Kateregga', 'naira@the-nkfoundation.org', 'admin'], ['Kizito Jamal', 'kizito@the-nkfoundation.org', 'manager'],
  ['Hamba Shabil', 'hamba@the-nkfoundation.org', 'manager'], ['Balqees Yasin', 'balqees@the-nkfoundation.org', 'manager'],
u  ['Shamsa Nantongo', 'shamsa@the-nkfoundation.org', 'manager'], ['Aminah Yarmah', 'aminah@the-nkfoundation.org', 'dpo'],
  ['Volunteer team', 'volunteers@the-nkfoundation.org', 'volunteer'],
]

const { data: existing, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listError) throw listError
const usersByEmail = new Map(existing.users.map((user) => [user.email?.toLowerCase(), user]))

async function provision(name, email, role, password) {
  let user = usersByEmail.get(email)
  if (user) {
    // Idempotent reruns repair metadata/profiles but do not reset passwords.
    const { error } = await supabase.auth.admin.updateUserById(user.id, { email_confirm: true, user_metadata: { full_name: name, role } })
    if (error) throw error
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role } })
    if (error || !data.user) throw error ?? new Error(`Could not create ${email}`)
    user = data.user
  }
  const { error } = await supabase.from('profiles').upsert({ id: user.id, full_name: name, role }, { onConflict: 'id' })
  if (error) throw error
  console.log(`Provisioned ${email}`)
}

for (const [name, email, role] of roster) await provision(name, email, role, process.env.NK_SHARED_INITIAL_PASSWORD)
await provision('Emergency Administrator', process.env.NK_MASTER_ADMIN_EMAIL.toLowerCase(), 'admin', process.env.NK_MASTER_ADMIN_PASSWORD)
console.log('Provisioning complete. Store the recovery password only in a password manager.')
