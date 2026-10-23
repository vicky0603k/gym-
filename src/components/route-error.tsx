"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { ErrorState } from "./states";

/** Body of every error.tsx: plain message + Retry that re-fetches the server data. */
export function RouteError({ reset, message }: { reset: () => void; message?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <ErrorState
      title="Couldn't load this page"
      message={message ?? "Check your internet connection and try again."}
      action={
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
        >
          <RotateCw className="h-4 w-4" aria-hidden />
          {pending ? "Retrying…" : "Retry"}
        </button>
      }
    />
  );
}
