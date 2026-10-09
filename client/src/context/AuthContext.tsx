import { createContext, ReactNode, useContext, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, refreshSession } from '@/lib/api';

export type User = { id: string; email: string; fullName: string; phone: string | null; platformRole: 'USER' | 'SUPER_ADMIN'; emailVerified: boolean; hasPhoto?: boolean; photoV?: number; gender?: string | null; address?: string | null; emergencyName?: string | null; emergencyPhone?: string | null };
export type MembershipInfo = { id: string; role: 'MEMBER' | 'LEADER'; status: string; group: { id: string; name: string; slug: string; status: string; plan?: { state: 'TRIAL' | 'PRO' | 'EXPIRED'; daysLeft: number } } };
type Me = { user: User; memberships: MembershipInfo[] };

type Ctx = { me: Me | null; loading: boolean; login: (b: { email: string; password: string }) => Promise<unknown>; register: (b: Record<string, string>) => Promise<unknown>; logout: () => Promise<void> };
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['me'], retry: false, staleTime: 60_000,
    queryFn: async () => { try { return await api<Me>('/auth/me'); } catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e; } },
  });
  // Keep the session fresh so receipt links, CSV downloads and page reloads never hit an expired token.
  const signedIn = !!q.data;
  useEffect(() => {
    if (!signedIn) return;
    const tick = () => { void refreshSession(); };
    const id = setInterval(tick, 10 * 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [signedIn]);
  const refreshMe = () => qc.invalidateQueries({ queryKey: ['me'] });
  const login = useMutation({ mutationFn: (b: { email: string; password: string }) => api('/auth/login', { method: 'POST', body: b }), onSuccess: refreshMe });
  const register = useMutation({ mutationFn: (b: Record<string, string>) => api('/auth/register', { method: 'POST', body: b }), onSuccess: refreshMe });
  const logout = useMutation({ mutationFn: () => api('/auth/logout', { method: 'POST' }), onSuccess: () => { qc.setQueryData(['me'], null); qc.clear(); } });
  return (
    <AuthCtx.Provider value={{ me: q.data ?? null, loading: q.isLoading, login: login.mutateAsync, register: register.mutateAsync, logout: async () => { await logout.mutateAsync(); } }}>
      {children}
    </AuthCtx.Provider>
  );
}
export const useAuth = () => { const c = useContext(AuthCtx); if (!c) throw new Error('useAuth outside AuthProvider'); return c; };
