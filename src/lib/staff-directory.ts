export type StaffDirectoryEntry = { id: string; full_name: string; role: string }

export async function loadStaffDirectory(supabase: any): Promise<StaffDirectoryEntry[]> {
  const { data, error } = await supabase.rpc('staff_directory')
  if (error) throw error
  return (data || []) as StaffDirectoryEntry[]
}

export function staffProfile(entries: StaffDirectoryEntry[], id: string | null | undefined) {
  const member = entries.find(entry => entry.id === id)
  return member ? { full_name: member.full_name } : null
}
