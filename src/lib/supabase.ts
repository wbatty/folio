import { createClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis as unknown as {
  supabase: ReturnType<typeof createClient>;
};

function createSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const supabase =
  globalForSupabase.supabase ?? createSupabaseClient();

if (process.env.NODE_ENV !== "production")
  globalForSupabase.supabase = supabase;
