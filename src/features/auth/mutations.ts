"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations";
import { DEMO_ACCOUNTS } from "@/features/auth/demo-accounts";

export type LoginState = { error: string } | undefined;

export async function login(formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Invalid email or password." };
  }

  revalidatePath("/", "layout");
  redirect("/department");
}

/**
 * One-click sign-in as a demo account. A real password sign-in, so RLS
 * applies exactly as for a typed login. The picker is only rendered when
 * DEMO_LOGIN is on, but a server action can be called directly by anyone
 * who has its id, so the flag and the account list are both checked here.
 */
export async function demoSignIn(email: string): Promise<LoginState> {
  if (process.env.DEMO_LOGIN !== "true") {
    throw new Error("Demo sign-in is disabled.");
  }
  if (!DEMO_ACCOUNTS.some((account) => account.email === email)) {
    throw new Error("Not a demo account.");
  }

  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    return { error: "Demo sign-in is not configured." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Demo sign-in failed." };
  }

  revalidatePath("/", "layout");
  redirect("/department");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth/login");
}