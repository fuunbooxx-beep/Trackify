import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/auth-user";

export async function requireServerAdmin() {
  const supabase = await createSupabaseServerClient();
  const user = (await supabase.auth.getUser()).data.user;
  return user?.email?.trim().toLowerCase() === ADMIN_EMAIL ? user : null;
}
