export interface WineReview {
  source: string
  score: number | null
  quote: string
}

export interface Wine {
  id: string
  user_id: string
  name: string
  winery: string | null
  vintage: string | null
  varietal: string | null
  region: string | null
  country: string | null
  type: 'red' | 'white' | 'rose' | 'sparkling' | 'dessert'
  body: 'light' | 'medium' | 'full' | null
  sweetness: 'dry' | 'off-dry' | 'sweet' | null
  flavor_profile: string[] | null
  description: string | null
  reviews: WineReview[] | null
  qty: number
  image_url: string | null
  image_base64: string | null
  date_added: string
  created_at: string
}

export interface EventPreferences {
  time?: string[]
  setting?: string[]
  food?: string[]
  occasion?: string[]
  body?: string[]
  sweetness?: string[]
}

export interface Recommendation {
  id: string
  reason: string
  reviewHighlight: string
}

export const WINE_TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  red:       { bg: 'rgba(123,29,46,0.3)',   text: '#F5A0AE', dot: '#9B2335' },
  white:     { bg: 'rgba(212,192,106,0.2)', text: '#E8D87A', dot: '#D4C06A' },
  rose:      { bg: 'rgba(196,97,122,0.25)', text: '#F0A0B8', dot: '#C4617A' },
  sparkling: { bg: 'rgba(168,197,218,0.2)', text: '#B8DCF0', dot: '#A8C5DA' },
  dessert:   { bg: 'rgba(200,136,58,0.2)',  text: '#E8B870', dot: '#C8883A' },
}

export const PREF_GROUPS = [
  { key: 'time',      label: 'Time of Event',       opts: ['Daytime','Evening','Late Night'] },
  { key: 'setting',   label: 'Setting',              opts: ['Indoor','Outdoor','Formal','Casual'] },
  { key: 'food',      label: 'Food Being Served',    opts: ['Charcuterie & Cheese','Seafood','Red Meat','Pasta & Grains','Spicy Food','Desserts','No Food'] },
  { key: 'occasion',  label: 'Occasion',             opts: ['Dinner Party','Celebration','Romantic Evening','Business / Networking','Casual Hangout','Holiday Gathering'] },
  { key: 'body',      label: 'Body Preference',      opts: ['Light','Medium','Full','No Preference'] },
  { key: 'sweetness', label: 'Sweetness Preference', opts: ['Dry','Off-Dry','Sweet','No Preference'] },
]