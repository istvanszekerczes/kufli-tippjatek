/**
 * Production fallback — same rules as environment.ts. Safe to commit the URL and
 * the publishable (anon) key; never the secret key.
 */
export const environment = {
  production: true,
  supabaseUrl: 'https://qehmgeeejcnfsblkrvgq.supabase.co',
  supabaseAnonKey: 'sb_publishable_o_6RnvaSW_gPoKyaZCtoZg_V3fkARMx'
};
