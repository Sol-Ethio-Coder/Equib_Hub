import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Field, FormError, FormSuccess } from '@/components/Form';
import { useAuth } from '@/context/AuthContext';
import { api, ApiError, upload } from '@/lib/api';
import { Avatar } from '@/components/Avatar';

function useForm(run: (d: Record<string, string>) => Promise<string>) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [ok, setOk] = useState(''), [fields, setFields] = useState<Record<string, string[]>>({});
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; setBusy(true); setErr(''); setOk(''); setFields({});
    try { setOk(await run(Object.fromEntries(new FormData(form)) as Record<string, string>)); if (form.dataset.reset) form.reset(); }
    catch (x) { if (x instanceof ApiError) { setErr(x.message); setFields(x.fields ?? {}); } else setErr('Network error. Try again.'); }
    finally { setBusy(false); }
  };
  return { submit, busy, err, ok, fe: (k: string) => fields[k]?.[0] };
}

export default function ProfilePage() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const profile = useForm(async (d) => { await api('/auth/profile', { method: 'PATCH', body: d }); await qc.invalidateQueries({ queryKey: ['me'] }); return 'Profile saved.'; });
  const [photoMsg, setPhotoMsg] = useState('');
  const onPhoto = async (file?: File) => {
    if (!file) return; setPhotoMsg('');
    const f = new FormData(); f.append('file', file);
    try { await upload('/auth/profile/photo', f); await qc.invalidateQueries({ queryKey: ['me'] }); setPhotoMsg('Photo updated.'); } catch (e) { setPhotoMsg((e as Error).message); }
  };
  const pass = useForm(async (d) => { await api('/auth/change-password', { method: 'POST', body: d }); return 'Password changed. Other devices were signed out.'; });
  if (!me) return null;
  const u = me.user;
  return (
    <AppShell>
      <Link to="/app" className="text-sm text-brand hover:underline">← Dashboard</Link>
      <h1 className="mt-2 text-2xl font-bold">Your profile</h1>
      <p className="text-muted">{u.email} · {u.emailVerified ? 'email verified' : 'email not verified'}</p>
      <div className="card mt-6 flex flex-wrap items-center gap-5 p-5">
        <Avatar id={u.id} name={u.fullName} hasPhoto={u.hasPhoto} v={u.photoV} size={72} />
        <div>
          <label className="btn-ghost cursor-pointer">Change photo<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ''; }} /></label>
          <p className="mt-2 text-xs text-muted">JPG, PNG or WebP, up to 2 MB. Only you, your group leaders and admins can see it.</p>
          {photoMsg && <p role="status" className="mt-1 text-sm">{photoMsg}</p>}
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={profile.submit} className="card space-y-4 p-6" noValidate>
          <h2 className="text-lg font-semibold">Personal details</h2>
          <FormError>{profile.err}</FormError><FormSuccess>{profile.ok}</FormSuccess>
          <Field label="Full name" name="fullName" defaultValue={u.fullName} required error={profile.fe('fullName')} />
          <Field label="Phone" name="phone" type="tel" defaultValue={u.phone ?? ''} placeholder="0911 22 33 44" error={profile.fe('phone')} />
          <div><label className="label" htmlFor="gender">Gender (optional)</label>
            <select id="gender" name="gender" className="input" defaultValue={u.gender ?? ''}><option value="">Prefer not to say</option><option>Female</option><option>Male</option></select></div>
          <Field label="Address / location (optional)" name="address" defaultValue={u.address ?? ''} error={profile.fe('address')} />
          <Field label="Emergency contact name (optional)" name="emergencyName" defaultValue={u.emergencyName ?? ''} error={profile.fe('emergencyName')} />
          <Field label="Emergency contact phone (optional)" name="emergencyPhone" type="tel" defaultValue={u.emergencyPhone ?? ''} error={profile.fe('emergencyPhone')} />
          <button className="btn-primary" disabled={profile.busy}>{profile.busy ? 'Saving…' : 'Save changes'}</button>
        </form>
        <form onSubmit={pass.submit} data-reset="1" className="card h-fit space-y-4 p-6" noValidate>
          <h2 className="text-lg font-semibold">Change password</h2>
          <FormError>{pass.err}</FormError><FormSuccess>{pass.ok}</FormSuccess>
          <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" required error={pass.fe('currentPassword')} />
          <Field label="New password" name="newPassword" type="password" autoComplete="new-password" required hint="At least 10 characters, with a letter and a number." error={pass.fe('newPassword')} />
          <button className="btn-primary" disabled={pass.busy}>{pass.busy ? 'Updating…' : 'Update password'}</button>
        </form>
      </div>
    </AppShell>
  );
}
