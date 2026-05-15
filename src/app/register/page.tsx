/**
 * Register page — creates a new account + inserts into public.users
 * The DB trigger handle_new_user() does this automatically, but we
 * also pass full_name in metadata for display purposes.
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const email = form.get('email') as string
    const password = form.get('password') as string
    const fullName = form.get('full_name') as string

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // After email confirmation, redirect back to the app
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Check your inbox</h2>
          <p className="text-slate-400 text-sm">
            We sent a confirmation link to your email. Click it to activate your account.
          </p>
          <a href="/login" className="mt-6 inline-block text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
            ← Back to login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-4">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white tracking-tight">Create account</h1>
            <p className="text-slate-400 text-sm mt-1">New accounts default to <span className="text-indigo-400">viewer</span> role</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" id="register-form">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-slate-300 mb-1.5">Full name</label>
              <input
                id="full_name" name="full_name" type="text" required
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="Arjun Mehta"
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                id="reg-email" name="email" type="email" required autoComplete="email"
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input
                id="reg-password" name="password" type="password" required minLength={8}
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="Min. 8 characters"
              />
            </div>

            {error && (
              <div id="register-error" className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              id="register-submit" type="submit" disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60
                         text-white font-semibold transition-all duration-200"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-slate-500 text-xs mt-6">
            Already have an account?{' '}
            <a href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  )
}
