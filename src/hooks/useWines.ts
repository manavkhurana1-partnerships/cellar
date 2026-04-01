import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Wine } from '../types'
import { useAuth } from './useAuth'
import toast from 'react-hot-toast'

const LOCAL_KEY = 'cellar_guest_wines'

// ─── Image compression — shrinks ~2MB photo to ~30KB ──────────
async function compressImage(base64: string): Promise<string | null> {
  if (!base64) return null
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const MAX = 600
      let w = img.width
      let h = img.height
      if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX } }
      else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX } }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      const compressed = canvas.toDataURL('image/jpeg', 0.4).split(',')[1]
      resolve(compressed)
    }
    img.onerror = () => resolve(base64)
    img.src = 'data:image/jpeg;base64,' + base64
  })
}

// ─── Strip heavy fields for local storage ─────────────────────
function stripForLocal(wine: Wine): any {
  return {
    id: wine.id,
    user_id: wine.user_id,
    name: wine.name,
    winery: wine.winery,
    vintage: wine.vintage,
    varietal: wine.varietal,
    region: wine.region,
    country: wine.country,
    type: wine.type,
    body: wine.body,
    sweetness: wine.sweetness,
    flavor_profile: wine.flavor_profile,
    description: wine.description,
    // Only keep top 2 reviews to save space
    reviews: (wine.reviews ?? []).slice(0, 2).map(r => ({
      source: r.source,
      score: r.score,
      quote: r.quote?.slice(0, 120),
    })),
    qty: wine.qty,
    // Compress image stored locally
    image_base64: wine.image_base64,
    image_url: wine.image_url,
    date_added: wine.date_added,
    created_at: wine.created_at,
  }
}

// ─── Local storage helpers ─────────────────────────────────────
function loadLocalWines(): Wine[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveLocalWines(wines: Wine[]) {
  try {
    // Store stripped versions to save space
    const stripped = wines.map(stripForLocal)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(stripped))
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError') {
      // If still full, remove images from oldest wines
      const noImages = wines.map(w => ({ ...stripForLocal(w), image_base64: null }))
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(noImages))
        toast.error('Storage nearly full — photos removed from older wines. Sign in to save more.')
      } catch {
        // Remove oldest half
        const half = wines.slice(0, Math.floor(wines.length / 2))
        localStorage.setItem(LOCAL_KEY, JSON.stringify(half.map(stripForLocal)))
        toast.error('Storage full — oldest wines removed. Sign in for unlimited storage.')
      }
    }
  }
}

// ─── Hook ─────────────────────────────────────────────────────
export function useWines() {
  const { user } = useAuth()
  const [wines, setWines] = useState<Wine[]>([])
  const [loading, setLoading] = useState(true)

  const fetchWines = useCallback(async () => {
    setLoading(true)
    if (user) {
      const { data, error } = await supabase
        .from('wines')
        .select('id, user_id, name, winery, vintage, varietal, region, country, type, body, sweetness, flavor_profile, description, reviews, qty, image_base64, image_url, date_added, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) toast.error('Failed to load wines')
      else setWines(data as Wine[])
    } else {
      setWines(loadLocalWines())
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchWines() }, [fetchWines])

  const addWine = async (wine: Omit<Wine, 'created_at'>) => {
    // Compress image before storing — reduces ~2MB to ~30KB
    let compressed = wine.image_base64
    if (compressed) {
      compressed = await compressImage(compressed)
    }
    const wineToSave = { ...wine, image_base64: compressed }

    if (user) {
      const { data, error } = await supabase
        .from('wines')
        .insert({ ...wineToSave, user_id: user.id })
        .select()
        .single()
      if (error) { toast.error('Failed to save wine'); throw error }
      const newWine = data as Wine
      setWines(prev => [newWine, ...prev])
      toast.success(wine.name + ' added to your cellar!')
      return newWine
    } else {
      const newWine: Wine = {
        ...wineToSave,
        user_id: 'guest',
        created_at: new Date().toISOString(),
      } as Wine
      const updated = [newWine, ...loadLocalWines()]
      saveLocalWines(updated)
      setWines(updated)
      toast.success(wine.name + ' added to your cellar!')
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
