"use client";

import { KeyRound, UserMinus, UserPlus, UserRoundCheck } from "lucide-react";
import { FormField } from "@/components/form-field";
import { FormDialog, fieldProps } from "@/components/form-dialog";
import { createStaffAction, resetStaffPasswordAction, setStaffActiveAction } from "./actions";

const PASSWORD_HINT = "At least 10 characters. Tell them in person — it is never sent or shown again.";

export function AddStaffDialog() {
  return (
    <FormDialog<{ id: string }>
      trigger={
        <>
          <UserPlus className="h-4 w-4" aria-hidden /> Add front-desk login
        </>
      }
      triggerClassName="btn-primary inline-flex items-center gap-2"
      title="Add a front-desk login"
      description="Front desk can check members in, take payments, reset PINs and log follow-ups. They can't verify payments, change prices or see settings."
      submitLabel="Create login"
      success="Login created — they can log in now"
      action={createStaffAction}
    >
      {(errors) => (
        <>
          <FormField label="Name" htmlFor="name" error={errors.fields?.name}>
            <input {...fieldProps("name", errors.fields?.name)} maxLength={60} autoComplete="off" required />
          </FormField>
          <FormField label="Email (used to log in)" htmlFor="email" error={errors.fields?.email}>
            <input {...fieldProps("email", errors.fields?.email)} type="email" inputMode="email" autoComplete="off" required />
          </FormField>
          <FormField label="Starting password" htmlFor="password" error={errors.fields?.password} hint={PASSWORD_HINT}>
            <input {...fieldProps("password", errors.fields?.password)} type="password" autoComplete="new-password" minLength={10} required />
          </FormField>
        </>
      )}
    </FormDialog>
  );
}

export function ResetStaffPasswordDialog({ staffId, name }: { staffId: string; name: string }) {
  return (
    <FormDialog
      trigger={
        <>
          <KeyRound className="h-4 w-4" aria-hidden /> Reset password
        </>
      }
      title={`Set a new password for ${name}?`}
      description="Their old password stops working straight away."
      submitLabel="Set password"
      success={`New password set for ${name}`}
      action={(fd) => resetStaffPasswordAction(staffId, fd)}
    >
      {(errors) => (
        <FormField label="New password" htmlFor="password" error={errors.fields?.password} hint={PASSWORD_HINT}>
          <input {...fieldProps("password", errors.fields?.password)} type="password" autoComplete="new-password" minLength={10} required />
        </FormField>
      )}
    </FormDialog>
  );
}

export function StaffAccessDialog({ staffId, name, active }: { staffId: string; name: string; active: boolean }) {
  return (
    <FormDialog
      trigger={
        active ? (
          <>
            <UserMinus className="h-4 w-4" aria-hidden /> Remove access
          </>
        ) : (
          <>
            <UserRoundCheck className="h-4 w-4" aria-hidden /> Restore access
          </>
        )
      }
      triggerClassName={active ? "btn-danger inline-flex items-center gap-2" : "btn-secondary inline-flex items-center gap-2"}
      title={active ? `Remove ${name}'s access?` : `Restore ${name}'s access?`}
      description={
        active
          ? "They are logged out and can't log in again. Everything they recorded stays, with their name."
          : "They can log in again with their existing password."
      }
      submitLabel={active ? "Remove access" : "Restore access"}
      submitClassName={active ? "btn-danger" : "btn-primary"}
      success={active ? `${name} can no longer log in` : `${name} can log in again`}
      action={() => setStaffActiveAction(staffId, !active)}
    >
      {() => null}
    </FormDialog>
  );
}
