import { createClient } from '@supabase/supabase-js';

const url = 'https://trxmbkkxfafrommyhwkl.supabase.co';
const key =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyeG1ia2t4ZmFmcm9tbXlod2tsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDQ4NDgsImV4cCI6MjA5NDc4MDg0OH0.0FVpomLNP5N5sBZv3-dDPBNVVdxnqq6e37vUt9ikBAo';

const supabase = createClient(url, key);

// 1. Auth service reachability
const { data: session } = await supabase.auth.getSession();
console.log('[Auth] Session check:', session !== undefined ? '✅ OK' : '❌ Failed');

// 2. sites table probe
const { data, error } = await supabase.from('sites').select('id').limit(1);
if (error) {
  if (error.code === '42P01' || error.message?.includes('does not exist')) {
    console.log('[DB]   sites table: ❌ Table does not exist yet — run supabase/schema.sql first');
  } else if (error.code === 'PGRST301' || error.message?.includes('permission')) {
    console.log('[DB]   sites table: ✅ Connected but no SELECT permission (expected — RLS working correctly)');
  } else {
    console.log('[DB]   sites table:', `❌ ${error.code}: ${error.message}`);
  }
} else {
  console.log('[DB]   sites table: ✅ Exists and readable');
  console.log('[DB]   Row count:', data.length);
}
