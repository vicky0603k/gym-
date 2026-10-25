"use client";

import { CalendarClock, KeyRound } from "lucide-react";
import { FormField } from "@/components/form-field";
import { FormDialog, fieldProps } from "@/components/form-dialog";
import { formatDisplayDate } from "@/utils/dates";
import { correctExpiryAction, resetPinAction } from "../actions";

/** Any staff member: set a new 4-digit PIN for a member who forgot theirs. */
export function ResetPinDialog({ memberId, memberName }: { memberId: string; memberName: string }) {
  return (
    <FormDialog
      trigger={
        <>
          <KeyRound className="h-4 w-4" aria-hidden /> Reset PIN
        </>
      }
      title={`Reset ${memberName}'s PIN?`}
      description="Do this only with the member in front of you. Their old PIN stops working and any login lockout is cleared."
      submitLabel="Set new PIN"
      success={`New PIN set for ${memberName}`}
      action={(fd) => resetPinAction(memberId, fd)}
    >
      {(errors) => (
        <FormField label="New 4-digit PIN" htmlFor="pin" error={errors.fields?.pin} hint="Let the member type it, or tell them in person.">
          <input {...fieldProps("pin", errors.fields?.pin)} type="password" inputMode="numeric" autoComplete="off" maxLength={4} pattern="\d{4}" required />
        </FormField>
      )}
    </FormDialog>
  );
}

/** Owner only: fix a wrong expiry date, with a reason for the audit log. */
export function CorrectExpiryDialog({ memberId, memberName, expiryDate, startDate }: { memberId: string; memberName: string; expiryDate: string; startDate: string }) {
  return (
    <FormDialog
      trigger={
        <>
          <CalendarClock className="h-4 w-4" aria-hidden /> Correct expiry
        </>
      }
      title={`Correct ${memberName}'s expiry?`}
      description={`Currently valid till ${formatDisplayDate(expiryDate)}. Use this for typing mistakes or a goodwill extension — renewals go through payments.`}
      submitLabel="Save date"
      success={`${memberName}'s expiry updated`}
      action={(fd) => correctExpiryAction(memberId, fd)}
    >
      {(errors) => (
        <>
          <FormField label="Correct expiry date" htmlFor="expiryDate" error={errors.fields?.expiryDate}>
            <input {...fieldProps("expiryDate", errors.fields?.expiryDate)} type="date" defaultValue={expiryDate} min={startDate} required />
          </FormField>
          <FormField label="Reason" htmlFor="reason" error={errors.fields?.reason}>
            <textarea {...fieldProps("reason", errors.fields?.reason)} rows={3} maxLength={300} placeholder="e.g. Typed the wrong month when adding the member" required />
          </FormField>
        </>
      )}
    </FormDialog>
  );
}
