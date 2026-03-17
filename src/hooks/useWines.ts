import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Wine } from '../types'
import { useAuth } from './useAuth'
import toast from 'react-hot-toast'

export function useWines() {
  const { user } = useAuth()
  const [wines, setWines] = useState<Wine[]>([])
  const [loading, setLoading] = useState(true)

  const fetchWines = useCallback(async () => {
    if (!user) { setWines([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase.from('wines').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (error) toast.error('Failed to load wines')
    else setWines(data as Wine[])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchWines() }, [fetchWines])

  const addWine = async (wine: Omit<Wine, 'created_at'>) => {
    if (!user) return null
    const { data, error } = await supabase.from('wines').insert({ ...wine, user_id: user.id }).select().single()
    if (error) { toast.error('Failed to save wine'); throw error }
    setWines(prev => [data as Wine, ...prev])
    toast.success(`${wine.name} added to your cellar!`)
    return data as Wine
  }

  const updateWine = async (id: string, updates: Partial<Wine>) => {
    const { data, error } = await supabase.from('wines').update(updates).eq('id', id).select().single()
    if (error) { toast.error('Failed to update'); throw error }
    setWines(prev => prev.map(w => w.id === id ? data as Wine : w))
    return data as Wine
  }

  const deleteWine = async (id: string) => {
    const { error } = await supabase.from('wines').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); throw error }
    setWines(prev => prev.filter(w => w.id !== id))
    toast.success('Wine removed from cellar')
  }

  return { wines, loading, addWine, updateWine, deleteWine }
}