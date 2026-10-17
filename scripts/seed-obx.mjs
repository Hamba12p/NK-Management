import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for an isolated test project.')

const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const fakeVolunteers = [
  { volunteer_number: 'NKV-900', full_name: 'Amina Test Volunteer', email: 'amina.nkv900@example.invalid', status: 'active' },
  { volunteer_number: 'NKV-901', full_name: 'Brian Test Volunteer', email: 'brian.nkv901@example.invalid', status: 'active' },
  { volunteer_number: 'NKV-902', full_name: 'Cathy Test Volunteer', email: 'cathy.nkv902@example.invalid', status: 'inactive' },
]
const { error } = await client.from('volunteer_roster').upsert(fakeVolunteers, { onConflict: 'volunteer_number' })
if (error) throw new Error(`Fake OBX seed failed: ${error.message}`)
process.stdout.write(`Seeded ${fakeVolunteers.length} fake OBX roster rows.\n`)
