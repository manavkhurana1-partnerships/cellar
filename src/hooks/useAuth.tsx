import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContext { user: User | null; session: Session | null; loading: boolean; signOut: () => Promise<void> }
const AuthCtx = createContext<AuthContext>({ user: null, session: null, loading: true, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setUser(session?.user ?? null); setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session); setUser(session?.user ?? null); setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  return <AuthCtx.Provider value={{ user, session, loading, signOut: () => supabase.auth.signOut() }}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)