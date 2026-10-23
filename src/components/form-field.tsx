/** Label + control + inline error/hint, used by every owner form. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

/** Non-field error shown at the bottom of a form, above the submit button. */
export function FormError({ message }: { message?: string }) {
  return (
    <p role="alert" aria-live="assertive" className="text-sm text-danger empty:hidden">
      {message}
    </p>
  );
}
