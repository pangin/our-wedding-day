import { createClient } from '@supabase/supabase-js';
import type { CommentStatus } from './commentPolicy';

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
