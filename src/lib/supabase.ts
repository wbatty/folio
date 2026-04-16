import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const globalForSupabase = globalThis as unknown as {
  supabase: ReturnType<typeof createSupabaseClient>;
};

function createSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

export const supabase =
  globalForSupabase.supabase ?? createSupabaseClient();

if (process.env.NODE_ENV !== "production")
  globalForSupabase.supabase = supabase;
