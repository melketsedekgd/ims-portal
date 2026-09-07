import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  roles: {
    key: string;
    name: string;
    departmentCode: string | null;
  }[];
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `id,
       full_name,
       job_title,
       user_roles (
         roles ( key, name ),
         departments ( code )
       )`
    )
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    jobTitle: data.job_title,
    roles: (data.user_roles ?? []).map((ur: any) => ({
      key: ur.roles?.key ?? "",
      name: ur.roles?.name ?? "",
      departmentCode: ur.departments?.code ?? null,
    })),
  };
});