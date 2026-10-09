import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { api, ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Field, FormError, FormSuccess } from '@/components/Form';

function useSubmit<T>(fn: (data: FormData) => Promise<T>, onDone?: (r: T) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); setError(''); setFields({});
    try { onDone?.(await fn(new FormData(e.currentTarget))); }
    catch (err) { if (err instanceof ApiError) { setError(err.message); setFields(err.fields ?? {}); } else setError('Network error. Check your connection and try again.'); }
    finally { setBusy(false); }
  };
  return { submit, busy, error, fe: (k: string) => fields[k]?.[0] };
}
const val = (d: FormData, k: string) => String(d.get(k) ?? '');

export function LoginPage() {
  const { me, login } = useAuth();
  const t = useT();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/app';
  const f = useSubmit((d) => login({ email: val(d, 'email'), password: val(d, 'password') }), () => nav(from, { replace: true }));
  if (me) return <Navigate to="/app" replace />;
  return (
    <AuthLayout title={t('welcomeBack')} subtitle={t('welcomeSub')}>
      <form onSubmit={f.submit} className="space-y-4" noValidate>
        <FormError>{f.error}</FormError>
        <Field label={t('email')} name="email" type="email" autoComplete="email" required error={f.fe('email')} />
        <Field label={t('password')} name="password" type="password" autoComplete="current-password" required error={f.fe('password')} />
        <button className="btn-primary w-full" disabled={f.busy}>{f.busy ? t('signingIn') : t('signIn')}</button>
        <div className="flex justify-between text-sm"><Link className="text-brand hover:underline" to="/forgot-password">{t('forgot')}</Link><Link className="text-brand hover:underline" to="/signup">{t('createAccount')}</Link></div>
      </form>
    </AuthLayout>
  );
}

export function SignupPage() {
  const { me, register } = useAuth();
  const t = useT();
  const nav = useNavigate();
  const f = useSubmit((d) => register({ fullName: val(d, 'fullName'), email: val(d, 'email'), phone: val(d, 'phone'), password: val(d, 'password') }), () => nav('/app', { replace: true }));
  if (me) return <Navigate to="/app" replace />;
  return (
    <AuthLayout title={t('signupTitle')} subtitle={t('signupSub')}>
      <form onSubmit={f.submit} className="space-y-4" noValidate>
        <FormError>{f.error}</FormError>
        <Field label={t('fullName')} name="fullName" autoComplete="name" required error={f.fe('fullName')} />
        <Field label="Email" name="email" type="email" autoComplete="email" required error={f.fe('email')} />
        <Field label={t('phoneOpt')} name="phone" type="tel" autoComplete="tel" placeholder="0911 22 33 44" error={f.fe('phone')} />
        <Field label="Password" name="password" type="password" autoComplete="new-password" required hint="At least 10 characters, with a letter and a number." error={f.fe('password')} />
        <button className="btn-primary w-full" disabled={f.busy}>{f.busy ? t('creating') : t('createAccount')}</button>
        <p className="text-center text-sm text-muted">Already registered? <Link className="text-brand hover:underline" to="/login">Sign in</Link></p>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [msg, setMsg] = useState('');
  const f = useSubmit((d) => api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email: val(d, 'email') } }), (r) => setMsg(r.message));
  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link that works for one hour.">
      <form onSubmit={f.submit} className="space-y-4" noValidate>
        <FormError>{f.error}</FormError><FormSuccess>{msg}</FormSuccess>
        <Field label="Email" name="email" type="email" autoComplete="email" required error={f.fe('email')} />
        <button className="btn-primary w-full" disabled={f.busy}>{f.busy ? 'Sending…' : 'Send reset link'}</button>
        <p className="text-center text-sm"><Link className="text-brand hover:underline" to="/login">Back to sign in</Link></p>
      </form>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const token = useSearchParams()[0].get('token') ?? '';
  const nav = useNavigate();
  const f = useSubmit((d) => api('/auth/reset-password', { method: 'POST', body: { token, password: val(d, 'password') } }), () => nav('/login', { replace: true }));
  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={f.submit} className="space-y-4" noValidate>
        {!token && <FormError>This reset link is incomplete. Request a new one.</FormError>}
        <FormError>{f.error}</FormError>
        <Field label="New password" name="password" type="password" autoComplete="new-password" required hint="At least 10 characters, with a letter and a number." error={f.fe('password')} />
        <button className="btn-primary w-full" disabled={f.busy || !token}>{f.busy ? 'Saving…' : 'Update password'}</button>
      </form>
    </AuthLayout>
  );
}

export function VerifyEmailPage() {
  const token = useSearchParams()[0].get('token') ?? '';
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [msg, setMsg] = useState('');
  const run = async () => {
    try { await api('/auth/verify-email', { method: 'POST', body: { token } }); setState('ok'); }
    catch (e) { setState('fail'); setMsg(e instanceof ApiError ? e.message : 'Could not verify your email.'); }
  };
  return (
    <AuthLayout title="Verify your email">
      {state === 'idle' && <button className="btn-primary w-full" onClick={run} disabled={!token}>Confirm my email</button>}
      {state === 'ok' && <><FormSuccess>Your email is verified.</FormSuccess><Link className="btn-primary mt-4 w-full" to="/app">Continue</Link></>}
      {state === 'fail' && <FormError>{msg}</FormError>}
    </AuthLayout>
  );
}
