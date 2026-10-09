import { InputHTMLAttributes, ReactNode } from 'react';

export function Field({ label, error, hint, ...p }: { label: string; error?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = p.id ?? p.name;
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} className={`input ${error ? 'border-danger' : ''}`} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} {...p} />
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-e`} className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
export const FormError = ({ children }: { children: ReactNode }) =>
  children ? <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{children}</p> : null;
export const FormSuccess = ({ children }: { children: ReactNode }) =>
  children ? <p role="status" className="rounded-xl border border-brand/40 bg-brand/10 px-3.5 py-2.5 text-sm">{children}</p> : null;
