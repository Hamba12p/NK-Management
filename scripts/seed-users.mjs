import { createClient } from '@supabase/supabase-js'

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NK_SHARED_INITIAL_PASSWORD', 'NK_MASTER_ADMIN_EMAIL', 'NK_MASTER_ADMIN_PASSWORD']
const missing = required.filter((name) => !process.env[name])
if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
if (process.env.NK_SHARED_INITIAL_PASSWORD === process.env.NK_MASTER_ADMIN_PASSWORD) throw new Error('NK_MASTER_ADMIN_PASSWORD must not match NK_SHARED_INITIAL_PASSWORD')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// Never touch Auth before verifying the remote schema. This prevents partially
// provisioned users when the migration has not yet been applied.
const { error: profilesCheckError } = await supabase.from('profiles').select('id, email, display_tag').limit(1)
if (profilesCheckError) {
  if (profilesCheckError.code === 'PGRST205') {
    throw new Error('The current Hub schema is missing. Apply all Supabase migrations, then run this command again.')
  }
  throw new Error(`Cannot verify public.profiles before seeding: ${profilesCheckError.message}`)
}

const roster = [
  { name: 'Naira Kateregga', email: 'nkateregga003@gmail.com', legacyEmail: 'naira@the-nkfoundation.org', role: 'admin', jobTitle: 'Founder & Coordinator', tag: 'NK', color: 'burgundy', accountType: 'person' },
  { name: 'Faizal Kizito Jamal', email: 'jfaizal633@gmail.com', legacyEmail: 'kizito@the-nkfoundation.org', role: 'manager', jobTitle: 'General Manager', tag: 'FKJ', color: 'soft-burgundy', accountType: 'person' },
  { name: 'Shamsa Nantongo', email: 'nantongoshamsa2@gmail.com', legacyEmail: 'shamsa@the-nkfoundation.org', role: 'manager', jobTitle: 'Finance & Procurement Manager', tag: 'SN', color: 'magenta', accountType: 'person' },
  { name: 'Hamba Shabil', email: 'shabehamba@gmail.com', legacyEmail: 'hamba@the-nkfoundation.org', role: 'manager', jobTitle: 'Operations & Programs Manager', tag: 'HS', color: 'rust', accountType: 'person' },
  { name: 'Amina Yarmah', email: 'aminayarmah@gmail.com', legacyEmail: 'aminah@the-nkfoundation.org', role: 'dpo', jobTitle: 'Volunteer Rep / DPO', tag: 'AY', color: 'burgundy', accountType: 'person' },
  { name: 'Admin', email: 'admin@the-nkfoundation.org', role: 'admin', jobTitle: 'Organization administrator', tag: 'ADM', color: 'ink', accountType: 'organization', master: true },
  { name: 'Volunteers', email: 'volunteers@the-nkfoundation.org', role: 'volunteer', jobTitle: 'Shared volunteer login', tag: 'VOL', color: 'soft-burgundy', accountType: 'shared' },
]

const { data: existing, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listError) throw listError
const usersByEmail = new Map(existing.users.map((user) => [user.email?.toLowerCase(), user]))

async function provision(member, password) {
  const email = member.email.toLowerCase()
  let user = usersByEmail.get(email) || (member.legacyEmail ? usersByEmail.get(member.legacyEmail) : undefined)
  const metadata = {
    full_name: member.name,
    role: member.role,
    job_title: member.jobTitle,
    account_type: member.accountType,
    display_tag: member.tag,
    display_color: member.color,
  }
  if (user) {
    // Idempotent reruns repair metadata/profiles but do not reset passwords.
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, { email, email_confirm: true, user_metadata: metadata })
    if (error) throw error
    user = data.user
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata })
    if (error || !data.user) throw error ?? new Error(`Could not create ${email}`)
    user = data.user
  }
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    full_name: member.name,
    email,
    role: member.role,
    job_title: member.jobTitle,
    account_type: member.accountType,
    display_tag: member.tag,
    display_color: member.color,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) throw error
  console.log(`Provisioned ${email}`)
}

if (process.env.NK_MASTER_ADMIN_EMAIL.toLowerCase() !== 'admin@the-nkfoundation.org') {
  throw new Error('NK_MASTER_ADMIN_EMAIL must be admin@the-nkfoundation.org for the authoritative roster.')
}

for (const member of roster) {
  await provision(member, member.master ? process.env.NK_MASTER_ADMIN_PASSWORD : process.env.NK_SHARED_INITIAL_PASSWORD)
}
console.log('Provisioning complete. Store the recovery password only in a password manager.')
