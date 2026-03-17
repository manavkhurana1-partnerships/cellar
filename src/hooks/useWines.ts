import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Wine } from '../types'
import { useAuth } from './useAuth'
import toast from 'react-hot-toast'

const LOCAL_KEY = 'cellar_guest_wines'

function loadLocalWines(): Wine[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveLocalWines(wines: Wine[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(wines))
}

export function useWines() {
  const { user } = useAuth()
  const [wines, setWines] = useState<Wine[]>([])
  const [loading, setLoading] = useState(true)

  const fetchWines = useCallback(async () => {
    setLoading(true)
    if (user) {
      // Signed in — load from Supabase
      const { data, error } = await supabase
        .from('wines')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) toast.error('Failed to load wines')
      else setWines(data as Wine[])
    } else {
      // Guest — load from localStorage
      setWines(loadLocalWines())
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchWines() }, [fetchWines])

  const addWine = async (wine: Omit<Wine, 'created_at'>) => {
    if (user) {
      // Signed in — save to Supabase
      const { data, error } = await supabase
        .from('wines')
        .insert({ ...wine, user_id: user.id })
        .select()
        .single()
      if (error) { toast.error('Failed to save wine'); throw error }
      const newWine = data as Wine
      setWines(prev => [newWine, ...prev])
      toast.success(`${wine.name} added to your cellar!`)
      return newWine
    } else {
      // Guest — save to localStorage
      const newWine = {
        ...wine,
        user_id: 'guest',
        created_at: new Date().toISOString(),
      } as Wine
      const updated = [newWine, ...loadLocalWines()]
      saveLocalWines(updated)
      setWines(updated)
      toast.success(`${wine.name} added to your cellar!`)
      return newWine
    }
  }

  const updateWine = async (id: string, updates: Partial<Wine>) => {
    if (user) {
      const { data, error } = await supabase
        .from('wines')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) { toast.error('Failed to update'); throw error }
      const updated = data as Wine
      setWines(prev => prev.map(w => w.id === id ? updated : w))
      return updated
    } else {
      const updated = loadLocalWines().map(w => w.id === id ? { ...w, ...updates } : w)
      saveLocalWines(updated)
      setWines(updated)
      return updated.find(w => w.id === id)!
    }
  }

  const deleteWine = async (id: string) => {
    if (user) {
      const { error } = await supabase.from('wines').delete().eq('id', id)
      if (error) { toast.error('Failed to delete'); throw error }
    } else {
      const updated = loadLocalWines().filter(w => w.id !== id)
      saveLocalWines(updated)
    }
    setWines(prev => prev.filter(w => w.id !== id))
    toast.success('Wine removed from cellar')
  }

  return { wines, loading, addWine, updateWine, deleteWine }
}
