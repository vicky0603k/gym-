"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/services/payments";
import { FormError } from "@/components/form-field";

export type DialogErrors = { fields?: Record<string, string>; message?: string };

/** Confirmed form in an app dialog; server field errors show inline, success toasts and refreshes. */
export function FormDialog<T>({
  trigger,
  triggerClassName = "btn-secondary px-3 whitespace-nowrap",
  title,
  description,
  submitLabel,
  submitClassName = "btn-primary",
  success,
  action,
  children,
}: {
  trigger: ReactNode;
  triggerClassName?: string;
  title: string;
  description: ReactNode;
  submitLabel: string;
  submitClassName?: string;
  success: string | ((data: T) => string);
  action: (formData: FormData) => Promise<ActionResult<T>>;
  children: (errors: DialogErrors) => ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<DialogErrors>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await action(new FormData(e.currentTarget));
      if (!result.ok) {
        setErrors({ fields: result.error.fields, message: result.error.fields ? undefined : result.error.message });
        return;
      }
      toast.success(typeof success === "function" ? success(result.data) : success);
      setOpen(false);
      router.refresh();
    } catch {
      setErrors({ message: "We couldn't reach the server. Check your internet and try again." });
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
      }}
    >
      <Dialog.Trigger className={triggerClassName}>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50 animate-fade-in" />
        <Dialog.Content className="fixed z-50 inset-x-4 bottom-4 max-h-[90vh] overflow-y-auto sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md rounded-lg border border-border bg-background p-5 shadow-xl animate-slide-up">
          <div className="flex items-start justify-between gap-3 mb-2">
            <Dialog.Title className="text-lg font-semibold text-foreground">{title}</Dialog.Title>
            <Dialog.Close className="btn-ghost -mt-2 -mr-2 px-3" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-muted mb-4">{description}</Dialog.Description>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {children(errors)}
            <FormError message={errors.message} />
            <div className="grid grid-cols-2 gap-3">
              <Dialog.Close type="button" className="btn-secondary">
                Cancel
              </Dialog.Close>
              <button type="submit" className={submitClassName} disabled={pending} aria-busy={pending}>
                {pending ? "Saving…" : submitLabel}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** id/name/aria wiring for an input inside FormDialog. */
export function fieldProps(name: string, error?: string) {
  return {
    id: name,
    name,
    className: "input",
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${name}-error` : undefined,
  };
}
