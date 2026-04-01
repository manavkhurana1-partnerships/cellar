import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export type Database = {
  public: {
    Tables: {
      wines: {
        Row: {
          id: string
          user_id: string
          name: string
          winery: string | null
          vintage: string | null
          varietal: string | null
          region: string | null
          country: string | null
          type: string
          body: string | null
          sweetness: string | null
          flavor_profile: string[] | null
          description: string | null
          reviews: any[] | null
          qty: number
          image_url: string | null
          image_base64: string | null
          date_added: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['wines']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['wines']['Insert']>
      }
    }
  }
}
