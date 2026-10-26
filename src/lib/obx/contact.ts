export type ObxContact =
  | { channel: 'email'; value: string }
  | { channel: 'phone'; value: string }

export function hasTwoObxIdentifiers(name: string, email: string | null, phone: string | null): boolean {
  return [name.trim(), email, phone].filter(Boolean).length >= 2
}

export function normaliseObxEmail(value: string): string | null {
  const email = value.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320 ? email : null
}

export function normaliseObxContact(value: string): ObxContact | null {
  const input = value.trim()
  if (input.includes('@')) {
    const email = normaliseObxEmail(input)
    return email
      ? { channel: 'email', value: email }
      : null
  }

  let phone = input.replace(/[()\s.-]/g, '')
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`
  else if (phone.startsWith('0')) phone = `+256${phone.slice(1)}`
  else if (phone.startsWith('256')) phone = `+${phone}`
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null
  return { channel: 'phone', value: phone }
}
