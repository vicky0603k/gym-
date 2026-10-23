"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ClipboardCheck, X } from "lucide-react";
import { toast } from "sonner";
import { FormError, FormField } from "@/components/form-field";
import { CHANNEL_LABELS, OUTCOME_LABELS } from "@/utils/follow-up-labels";
import { formatDisplayDate } from "@/utils/dates";
import type { FollowUpOutcome } from "@/services/supabase/database.types";
import { recordFollowUpAction } from "./actions";

/** Mark Outcome bottom sheet: channel, outcome, next action date, optional note. */
export function OutcomeDialog({
  caseId,
  memberName,
  today,
  defaultNextDate,
}: {
  caseId: string;
  memberName: string;
  today: string;
  defaultNextDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<FollowUpOutcome | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const closing = outcome === "Cancelled";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(undefined);
    const formData = new FormData(e.currentTarget);
    try {
      const result = await recordFollowUpAction(formData);
      if (!result.ok) {
        setErrors(result.error.fields ?? {});
        setMessage(result.error.fields ? undefined : result.error.message);
        return;
      }
      const next = formData.get("nextActionDate");
      toast.success(
        result.data.closed
          ? `${memberName}'s case closed. History is kept on their member page.`
          : `Follow-up saved — next on ${formatDisplayDate(String(next))}`
      );
      setOpen(false);
      setOutcome("");
      router.refresh();
    } catch {
      setMessage("We couldn't reach the server. Check your internet and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setErrors({});
        setMessage(undefined);
      }}
    >
      <Dialog.Trigger className="btn-primary inline-flex items-center justify-center gap-2 px-3 text-sm">
        <ClipboardCheck className="h-4 w-4" aria-hidden /> Outcome
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 animate-fade-in" />
        <Dialog.Content className="fixed z-50 inset-x-4 bottom-4 max-h-[90vh] overflow-y-auto sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md card p-5 animate-slide-up">
          <div className="flex items-start justify-between gap-3 mb-2">
            <Dialog.Title className="text-lg font-semibold text-foreground">Follow-up with {memberName}</Dialog.Title>
            <Dialog.Close className="btn-ghost -mt-2 -mr-2 px-3" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-muted mb-4">
            Saved to their history under your name. Follow-ups are never edited or deleted.
          </Dialog.Description>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <input type="hidden" name="caseId" value={caseId} />
            <FormField label="How did you reach them?" htmlFor="channel" error={errors.channel}>
              <select id="channel" name="channel" className="input" defaultValue="Call">
                {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="What did they say?" htmlFor="outcome" error={errors.outcome}>
              <select
                id="outcome"
                name="outcome"
                className="input"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as FollowUpOutcome)}
              >
                <option value="" disabled>
                  Choose an outcome
                </option>
                {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            {(outcome === "Injured" || outcome === "Travelling") && (
              <p className="text-sm text-warning">
                If they need a break, pause their membership from their member page so the days don&apos;t count against them.
              </p>
            )}
            {!closing && (
              <FormField label="Next follow-up on" htmlFor="nextActionDate" error={errors.nextActionDate}>
                <input id="nextActionDate" name="nextActionDate" type="date" min={today} defaultValue={defaultNextDate} className="input" />
              </FormField>
            )}
            <FormField label="Note (optional)" htmlFor="notes" error={errors.notes}>
              <textarea id="notes" name="notes" rows={2} maxLength={500} className="input" placeholder="e.g. Exams till Friday, will come Monday morning" />
            </FormField>
            <FormError message={message} />
            <div className="grid grid-cols-2 gap-3">
              <Dialog.Close type="button" className="btn-secondary">
                Cancel
              </Dialog.Close>
              <button type="submit" className={closing ? "btn-danger" : "btn-primary"} disabled={pending || !outcome} aria-busy={pending}>
                {pending ? "Saving…" : closing ? "Close case" : "Save"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
