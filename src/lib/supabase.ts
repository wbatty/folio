import { createClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis as unknown as {
  supabase: ReturnType<typeof createClient>;
};

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

export const supabase =
  globalForSupabase.supabase ?? createSupabaseClient();

if (process.env.NODE_ENV !== "production")
  globalForSupabase.supabase = supabase;
