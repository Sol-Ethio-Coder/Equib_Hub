import { useState } from 'react';

/** Profile photo with an initials fallback. Photos are private and only load for people allowed to see them. */
export function Avatar({ id, name = '', hasPhoto, v = 0, size = 32 }: { id?: string; name?: string; hasPhoto?: boolean; v?: number; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.4) };
  if (hasPhoto && id && !failed) return <img src={`/api/users/${id}/photo?v=${v}`} alt="" onError={() => setFailed(true)} style={style} className="shrink-0 rounded-full object-cover" />;
  return <span style={style} className="grid shrink-0 place-items-center rounded-full bg-brand/15 font-semibold text-brand" aria-hidden="true">{initials}</span>;
}
