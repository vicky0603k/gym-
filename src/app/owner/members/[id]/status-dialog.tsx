"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Pause, Play, X } from "lucide-react";
import { toast } from "sonner";
import { FormError, FormField } from "@/components/form-field";
import { pauseMemberAction, resumeMemberAction } from "../actions";

/** Pause (reason required) or resume, always confirmed in an app dialog. */
export function StatusDialog({ memberId, memberName, paused }: { memberId: string; memberName: string; paused: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{ field?: string; message?: string }>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const result = paused
        ? await resumeMemberAction(memberId)
        : await pauseMemberAction(memberId, new FormData(e.currentTarget));
      if (!result.ok) {
        setError({ field: result.error.fields?.reason, message: result.error.fields ? undefined : result.error.message });
        return;
      }
      toast.success(paused ? `${memberName}'s membership resumed` : `${memberName}'s membership paused`);
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
      <Dialog.Trigger className={paused ? "btn-primary inline-flex items-center gap-2" : "btn-danger inline-flex items-center gap-2"}>
        {paused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
        {paused ? "Resume" : "Pause"}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 animate-fade-in" />
        <Dialog.Content className="fixed z-50 inset-x-4 bottom-4 sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md card p-5 animate-slide-up">
          <div className="flex items-start justify-between gap-3 mb-2">
            <Dialog.Title className="text-lg font-semibold text-foreground">
              {paused ? `Resume ${memberName}?` : `Pause ${memberName}?`}
            </Dialog.Title>
            <Dialog.Close className="btn-ghost -mt-2 -mr-2 px-3" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-muted mb-4">
            {paused
              ? "Their membership becomes active again from today and they can check in."
              : "Their membership is frozen from today. They cannot check in and will not appear on the Red List until resumed."}
          </Dialog.Description>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {!paused && (
              <FormField label="Reason for pause" htmlFor="reason" error={error.field}>
                <textarea
                  id="reason"
                  name="reason"
                  rows={3}
                  maxLength={300}
                  className="input"
                  placeholder="e.g. Knee injury, travelling for work"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  aria-invalid={error.field ? true : undefined}
                  aria-describedby={error.field ? "reason-error" : undefined}
                />
              </FormField>
            )}
            <FormError message={error.message} />
            <div className="grid grid-cols-2 gap-3">
              <Dialog.Close type="button" className="btn-secondary">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                className={paused ? "btn-primary" : "btn-danger"}
                disabled={pending || (!paused && reason.trim().length < 3)}
                aria-busy={pending}
              >
                {pending ? "Saving…" : paused ? "Resume" : "Pause"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
