import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/utils/cn";

export function LogoutButton({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <form action={logoutAction} className={compact ? undefined : "w-full"}>
      <button type="submit" className={cn(buttonVariants({ variant: compact ? "ghost" : "outline", size: compact ? "sm" : "md" }), "text-muted", className)}>
        <LogOut className="h-4 w-4" aria-hidden /> Log out
      </button>
    </form>
  );
}
