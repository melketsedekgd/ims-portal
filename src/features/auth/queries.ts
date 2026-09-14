import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  roles: {
    key: string;
    name: string;
    departmentId: string | null;
    departmentCode: string | null;
    departmentName: string | null;
  }[];
};

type ProfileRow = {
  id: string;
  full_name: string;
  job_title: string | null;
  user_roles: {
    roles: { key: string; name: string } | null;
    departments: { id: string; name: string; code: string } | null;
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
         departments ( id, name, code )
       )`
    )
    .eq("id", user.id)
    .single()
    .returns<ProfileRow>();

  if (error || !data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    jobTitle: data.job_title,
    roles: (data.user_roles ?? []).map((ur) => ({
      key: ur.roles?.key ?? "",
      name: ur.roles?.name ?? "",
      departmentId: ur.departments?.id ?? null,
      departmentCode: ur.departments?.code ?? null,
      departmentName: ur.departments?.name ?? null,
    })),
  };
});