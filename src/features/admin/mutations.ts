"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/features/auth/queries";
import { isAdmin } from "@/lib/permissions";
import { createUserSchema, type CreateUserInput } from "./schema";

export type AdminWriteResult = { ok: true } | { ok: false; message: string };

// Roughly a century. Supabase has no permanent ban; "none" lifts it.
const BAN_DURATION = "876600h";

function revalidate() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/departments");
}

/**
 * Create an account: auth user, then profile and role. The secret-key
 * client bypasses RLS, so the explicit isAdmin() check at the top IS the
 * permission for step 2 — nothing downstream re-checks it. Steps 3 and 4
 * go through the caller's own client, where profiles_insert and
 * user_roles_write require IMS admin again. If either fails the auth user
 * is deleted: an account that signs in and appears broken is worse than
 * one that does not exist.
 */
export async function createUser(input: CreateUserInput): Promise<AdminWriteResult> {
  const me = await getCurrentUser();
  if (!isAdmin(me)) return { ok: false, message: "Only an IMS administrator can create users." };

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid user" };
  }
  const u = parsed.data;

  const supabase = await createClient();
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("key", u.roleKey)
    .single();
  if (roleError || !role) return { ok: false, message: `Role ${u.roleKey} is not in the catalogue.` };

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: u.fullName },
  });
  if (authError || !created.user) {
    return { ok: false, message: authError?.message ?? "The account could not be created." };
  }
  const id = created.user.id;

  const { error: profileError } = await supabase.from("profiles").insert({
    id,
    full_name: u.fullName,
    job_title: u.jobTitle?.trim() || null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(id);
    return { ok: false, message: profileError.message };
  }

  const { error: roleInsertError } = await supabase.from("user_roles").insert({
    profile_id: id,
    role_id: role.id,
    department_id: u.departmentId || null,
  });
  if (roleInsertError) {
    // profiles.id references auth.users on delete restrict, so the profile
    // goes first. Its own delete has no policy; the admin client removes it.
    await admin.from("profiles").delete().eq("id", id);
    await admin.auth.admin.deleteUser(id);
    return { ok: false, message: roleInsertError.message };
  }

  revalidate();
  return { ok: true };
}

/**
 * Remove a user's access: their role rows go, the profile is marked
 * inactive, and the auth account is banned. The profile itself is never
 * deleted — measurements, assessments and approvals reference it and must
 * stay attributed.
 */
export async function removeUser(profileId: string): Promise<AdminWriteResult> {
  const me = await getCurrentUser();
  if (!isAdmin(me)) return { ok: false, message: "Only an IMS administrator can remove users." };
  if (me!.id === profileId) return { ok: false, message: "You cannot remove your own access." };

  const supabase = await createClient();

  const { error: rolesError } = await supabase.from("user_roles").delete().eq("profile_id", profileId);
  if (rolesError) return { ok: false, message: rolesError.message };

  const { data: updated, error: profileError } = await supabase
    .from("profiles")
    .update({ status: "inactive" })
    .eq("id", profileId)
    .select("id");
  if (profileError) return { ok: false, message: profileError.message };
  if (!updated || updated.length === 0) return { ok: false, message: "No such user." };

  const admin = createAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(profileId, { ban_duration: BAN_DURATION });
  if (banError) {
    return { ok: false, message: `Roles removed and profile deactivated, but the account could not be banned: ${banError.message}` };
  }

  revalidate();
  return { ok: true };
}
