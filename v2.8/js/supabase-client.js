// V2.4 — client Supabase navigateur
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_u3OphiLKRZuzrDYBu899iw_5Xckr-nv";

const cloudClient=window.supabase?.createClient?window.supabase.createClient(
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true
    },
    // Les clients antérieurs au correctif ne doivent plus écrire sur les données restaurées.
    global:{headers:{"x-smart-budget-sync-version":"20261116-hf1"}}
  }
):null;
