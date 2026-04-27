'use server'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies as getCookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await getCookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Cookie might be read-only in certain contexts
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.delete(name)
          } catch (error) {
            // Cookie might be read-only in certain contexts
          }
        },
      },
    }
  )
}
