import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Este es el mensajero que usaremos en todo el CRM
export const supabase = createClient(supabaseUrl, supabaseAnonKey)