import { createClient } from '@supabase/supabase-js';

/**
 * Klien Supabase bersama untuk alur autentikasi
 * (login, lupa password, password baru).
 *
 * Dipakai satu klien saja supaya event PASSWORD_RECOVERY
 * dari Supabase Auth terbaca oleh halaman /reset-password.
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
