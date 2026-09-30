// V2.4 — client Supabase navigateur
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_u3OphiLKRZuzrDYBu899iw_5Xckr-nv";

const cloudClient=window.supabase.createClient(
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true
    }
  }
);
