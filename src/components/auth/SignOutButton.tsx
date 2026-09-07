import { logout } from "@/features/auth/mutations";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </form>
  );
}