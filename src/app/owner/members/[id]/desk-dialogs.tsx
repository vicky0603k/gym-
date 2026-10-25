"use client";

import { useState } from "react";
import { CalendarPlus, IndianRupee, UserCog, UserX } from "lucide-react";
import type { MemberStatus } from "@/services/supabase/database.types";
import { FormField } from "@/components/form-field";
import { FormDialog, fieldProps } from "@/components/form-dialog";
import { applyDiscount, formatRupees } from "@/utils/money";
import { anonymiseMemberAction, backfillAttendanceAction, deskRenewalAction, memberStatusAction } from "../actions";

type PlanOption = { id: string; name: string; price: number; discount_pct: number; duration_days: number };

/** Owner or front desk: a renewal paid at the counter in cash or UPI. Stays Pending until the owner verifies. */
export function DeskPaymentDialog({ memberId, memberName, plans, isOwner }: { memberId: string; memberName: string; plans: PlanOption[]; isOwner: boolean }) {
  const [method, setMethod] = useState<"Cash" | "UPI">("Cash");
  return (
    <FormDialog<{ reference: string; amount: number }>
      trigger={
        <>
          <IndianRupee className="h-4 w-4" aria-hidden /> Take payment
        </>
      }
      triggerClassName="btn-primary px-3 whitespace-nowrap"
      title={`Renew ${memberName} at the desk`}
      description={`The membership is extended once the owner verifies this payment${isOwner ? " in Renewals" : ""}.`}
      submitLabel="Record payment"
      success={(d) => `${formatRupees(d.amount)} recorded · ${d.reference}. ${isOwner ? "Verify it in Renewals to extend the membership." : "The owner will verify it."}`}
      action={(fd) => deskRenewalAction(memberId, fd)}
    >
      {(errors) => (
        <>
          <FormField label="Plan" htmlFor="planId" error={errors.fields?.planId}>
            <select {...fieldProps("planId", errors.fields?.planId)} defaultValue="" required>
              <option value="" disabled>
                Choose a plan
              </option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.duration_days} days · {formatRupees(applyDiscount(p.price, p.discount_pct))}
                </option>
              ))}
            </select>
          </FormField>
          <fieldset>
            <legend className="label">Paid by</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["Cash", "UPI"] as const).map((m) => (
                <label key={m} className={`${method === m ? "btn-primary" : "btn-secondary"} cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-foreground has-[:focus-visible]:ring-offset-2`}>
                  <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
                  {m === "Cash" ? "Cash" : "UPI"}
                </label>
              ))}
            </div>
          </fieldset>
          {method === "UPI" ? (
            <FormField label="UPI reference (UTR)" htmlFor="reference" error={errors.fields?.reference} hint="12 digits on the member's payment success screen.">
              <input {...fieldProps("reference", errors.fields?.reference)} autoComplete="off" maxLength={30} className="input uppercase" required />
            </FormField>
          ) : (
            <p className="text-sm text-muted">A cash receipt number is created automatically. Keep the cash aside until the owner verifies it.</p>
          )}
        </>
      )}
    </FormDialog>
  );
}

/** Staff: add a visit missed while the app was down (last 30 days). */
export function BackfillVisitDialog({ memberId, memberName, today }: { memberId: string; memberName: string; today: string }) {
  return (
    <FormDialog<{ caseResolved: boolean }>
      trigger={
        <>
          <CalendarPlus className="h-4 w-4" aria-hidden /> Add missed visit
        </>
      }
      title={`Add a missed visit for ${memberName}`}
      description="Only for a visit that really happened but wasn't recorded (for example the app or internet was down). It is logged with your name and reason."
      submitLabel="Add visit"
      success={(d) => `Visit added${d.caseResolved ? " — removed from the Red List" : ""}`}
      action={(fd) => backfillAttendanceAction(memberId, fd)}
    >
      {(errors) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date" htmlFor="date" error={errors.fields?.date}>
              <input {...fieldProps("date", errors.fields?.date)} type="date" max={today} defaultValue={today} required />
            </FormField>
            <FormField label="Time" htmlFor="time" error={errors.fields?.time}>
              <input {...fieldProps("time", errors.fields?.time)} type="time" defaultValue="07:00" required />
            </FormField>
          </div>
          <FormField label="Reason" htmlFor="reason" error={errors.fields?.reason}>
            <textarea {...fieldProps("reason", errors.fields?.reason)} rows={2} maxLength={200} placeholder="e.g. Gate tablet was offline in the morning" required />
          </FormField>
        </>
      )}
    </FormDialog>
  );
}

/** Owner: mark a member as left (Cancelled) or Blocked, or bring them back. */
export function MemberStatusDialog({ memberId, memberName, status }: { memberId: string; memberName: string; status: MemberStatus }) {
  const closed = status === "Cancelled" || status === "Blocked";
  return (
    <FormDialog
      trigger={
        <>
          <UserCog className="h-4 w-4" aria-hidden /> {closed ? "Reactivate" : "Cancel / block"}
        </>
      }
      title={closed ? `Reactivate ${memberName}?` : `Cancel or block ${memberName}?`}
      description={
        closed
          ? "They can check in again if their membership is running. Nothing in their history was changed."
          : "They can no longer check in or renew, and won't appear on the Red List. Payments and visits are kept."
      }
      submitLabel="Save"
      submitClassName={closed ? "btn-primary" : "btn-danger"}
      success={`${memberName}'s status updated`}
      action={(fd) => memberStatusAction(memberId, fd)}
    >
      {(errors) => (
        <>
          {closed ? (
            <input type="hidden" name="action" value="Reactivate" />
          ) : (
            <FormField label="What happened" htmlFor="action" error={errors.fields?.action}>
              <select {...fieldProps("action", errors.fields?.action)} defaultValue="Cancel">
                <option value="Cancel">Left the gym (Cancelled)</option>
                <option value="Block">Not allowed in (Blocked)</option>
              </select>
            </FormField>
          )}
          <FormField label="Reason" htmlFor="reason" error={errors.fields?.reason}>
            <textarea {...fieldProps("reason", errors.fields?.reason)} rows={2} maxLength={300} required />
          </FormField>
        </>
      )}
    </FormDialog>
  );
}

/** Owner, on the member's request: erase a cancelled member's name, phone and PIN. */
export function AnonymiseDialog({ memberId, memberName }: { memberId: string; memberName: string }) {
  return (
    <FormDialog
      trigger={
        <>
          <UserX className="h-4 w-4" aria-hidden /> Remove personal details
        </>
      }
      triggerClassName="btn-danger px-3 whitespace-nowrap"
      title={`Remove ${memberName}'s personal details?`}
      description="Only when the member asks. Their name, phone number and PIN are erased for good; payments and visits stay for your accounts. This can't be undone."
      submitLabel="Remove details"
      submitClassName="btn-danger"
      success="Personal details removed"
      action={() => anonymiseMemberAction(memberId)}
    >
      {() => null}
    </FormDialog>
  );
}
