import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Upsert into public.profiles (create table via supabase/profiles.sql). Safe to ignore if table missing. */
export async function syncSupabaseProfile(supabase: SupabaseClient, user: User) {
  const meta = user.user_metadata ?? {};
  const displayName =
    (meta.full_name as string | undefined) ||
    (meta.name as string | undefined) ||
    (meta.display_name as string | undefined) ||
    null;
  const avatarUrl =
    (meta.avatar_url as string | undefined) ||
    (meta.picture as string | undefined) ||
    null;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      display_name: displayName,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error && !/relation|does not exist/i.test(error.message)) {
    console.warn("[Supabase profiles]", error.message);
  }
}
