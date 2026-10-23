"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { FormError, FormField } from "@/components/form-field";
import { formatDisplayTime } from "@/utils/dates";
import { assistedCheckInAction } from "./actions";

/** Assisted check-in for one member. Cannot submit without a reason. */
export function AssistDialog({ memberId, memberName }: { memberId: string; memberName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{ field?: string; message?: string }>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await assistedCheckInAction(new FormData(e.currentTarget));
      if (!result.ok) {
        setError({ field: result.error.fields?.reason, message: result.error.fields ? undefined : result.error.message });
        return;
      }
      toast.success(
        `${memberName} checked in at ${formatDisplayTime(result.checkinAt)} · ${result.weeklyGoal.completed} of ${result.weeklyGoal.target} this week`
      );
      setOpen(false);
      setReason("");
      router.refresh();
    } catch {
      setError({ message: "We couldn't reach the server. Check your internet and try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setError({});
      }}
    >
      <Dialog.Trigger className="btn-primary inline-flex shrink-0 items-center gap-2 px-4 text-sm" aria-label={`Check in ${memberName}`}>
        <UserCheck className="h-4 w-4" aria-hidden /> Check in
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 animate-fade-in" />
        <Dialog.Content className="fixed z-50 inset-x-4 bottom-4 sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md card p-5 animate-slide-up">
          <div className="flex items-start justify-between gap-3 mb-2">
            <Dialog.Title className="text-lg font-semibold text-foreground">Check in {memberName}?</Dialog.Title>
            <Dialog.Close className="btn-ghost -mt-2 -mr-2 px-3" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-muted mb-4">
            Recorded as a front-desk check-in under your name, with the reason, in the audit log.
          </Dialog.Description>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <input type="hidden" name="memberId" value={memberId} />
            <FormField label="Why is this an assisted check-in?" htmlFor="reason" error={error.field}>
              <textarea
                id="reason"
                name="reason"
                rows={2}
                maxLength={200}
                className="input"
                placeholder="e.g. Phone battery dead, camera not working"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-invalid={error.field ? true : undefined}
                aria-describedby={error.field ? "reason-error" : undefined}
              />
            </FormField>
            <FormError message={error.message} />
            <div className="grid grid-cols-2 gap-3">
              <Dialog.Close type="button" className="btn-secondary">
                Cancel
              </Dialog.Close>
              <button type="submit" className="btn-primary" disabled={pending || reason.trim().length < 3} aria-busy={pending}>
                {pending ? "Saving…" : "Check in"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
