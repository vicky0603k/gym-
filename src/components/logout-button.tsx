import { logoutAction } from "@/app/login/actions";
import { cn } from "@/utils/cn";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction}>
      <button type="submit" className={cn("btn-ghost text-sm text-muted", className)}>
        Log out
      </button>
    </form>
  );
}
