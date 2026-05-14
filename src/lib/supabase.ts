import { createClient } from '@supabase/supabase-js';
import type { CommentStatus } from './commentPolicy';
import type { RsvpMeal, RsvpSide } from './rsvpPolicy';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    })
  : null;

export type GuestbookComment = {
  id: string;
  user_id: string;
  display_name: string;
  message: string;
  status: CommentStatus;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  rejection_reason: string | null;
};

export type RsvpResponse = {
  id: string;
  user_id: string;
  display_name: string;
  attending: boolean;
  side: RsvpSide;
  party_size: number;
  meal: RsvpMeal;
  contact: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
};
