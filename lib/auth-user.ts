import type { User as SupabaseUser } from "@supabase/supabase-js";
import { ADMIN_AVATAR_URL } from "@/lib/avatar";

/** App-facing user shape (matches what Navbar / Profile / Firestore expect). */
export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

export const ADMIN_EMAIL = "dinzypro@gmail.com";

export function isAdminUser(user: Pick<AppUser, "email"> | null | undefined) {
  return user?.email?.trim().toLowerCase() === ADMIN_EMAIL;
}

export function mapSupabaseUser(u: SupabaseUser | null): AppUser | null {
  if (!u) return null;
  const email = u.email ?? null;
  const meta = u.user_metadata ?? {};
  const fullName =
    (meta.full_name as string | undefined) ||
    (meta.name as string | undefined) ||
    (meta.display_name as string | undefined) ||
    null;
  const avatar =
    (meta.avatar_url as string | undefined) ||
    (meta.picture as string | undefined) ||
    null;
  return {
    uid: u.id,
    email,
    displayName: fullName,
    photoURL: email?.trim().toLowerCase() === ADMIN_EMAIL ? ADMIN_AVATAR_URL : avatar,
  };
}
