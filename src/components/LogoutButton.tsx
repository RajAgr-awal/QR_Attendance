/**
 * LogoutButton — Client Component.
 * Calls supabase.auth.signOut() and redirects to /login.
 */
'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      id="logout-btn"
      onClick={handleLogout}
      className="px-4 py-2 rounded-lg bg-white/5 hover:bg-red-500/10 border border-white/10
                 hover:border-red-500/30 text-slate-300 hover:text-red-400 text-sm font-medium
                 transition-all duration-200"
    >
      Sign out
    </button>
  )
}
