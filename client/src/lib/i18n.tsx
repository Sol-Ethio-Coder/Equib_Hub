import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { formatEthiopian } from '@/lib/ethiopian';

export type Lang = 'en' | 'am';
export type Cal = 'GC' | 'EC';

// English-first. Missing Amharic keys fall back to English, so new screens never break.
// Amharic strings should be reviewed by a native speaker before launch.
const dict: Record<Lang, Record<string, string>> = {
  en: {
    'nav.how': 'How it works', 'nav.features': 'Features', 'nav.pricing': 'Pricing', 'nav.faq': 'FAQ',
    signIn: 'Sign in', signOut: 'Sign out', profile: 'Profile', admin: 'Admin', startTrial: 'Start free trial', startTrialLong: 'Start your free trial',
    seeHow: 'See how it works', openDashboard: 'Open dashboard', tagline: 'Manage. Contribute. Grow Together.',
    heroSub: 'The simple, trusted way to run your Equb. Track every monthly contribution, check every receipt, and keep your whole group on the same page.',
    welcomeBack: 'Welcome back', welcomeSub: 'Sign in to see your Equb and contributions.', email: 'Email', password: 'Password',
    forgot: 'Forgot password?', createAccount: 'Create account', signingIn: 'Signing in…',
    signupTitle: 'Create your account', signupSub: 'Join an Equb or help your group get organised.', fullName: 'Full name', phoneOpt: 'Phone (optional)', creating: 'Creating account…',
    hello: 'Hello', myEqubs: 'My Equbs', findEqub: 'Find an Equb', requestJoin: 'Request to join', open: 'Open',
    month: 'Month', search: 'Search', status: 'Status', members: 'Members', announcements: 'Announcements', reports: 'Reports', myHistory: 'My history (PDF)',
    createRecords: "Create this month's records", uploadReceipt: 'Upload receipt', viewReceipt: 'View receipt', verify: 'Verify', reject: 'Reject',
    approve: 'Approve', suspend: 'Suspend', reactivate: 'Reactivate', remove: 'Remove', expected: 'Expected', awaiting: 'Awaiting review',
    invite: 'Create invite link', addMember: 'Add member', addByEmail: 'Add by email',
    'st.VERIFIED': 'Verified', 'st.SUBMITTED': 'Submitted', 'st.PENDING': 'Pending', 'st.REJECTED': 'Rejected', 'st.OVERDUE': 'Overdue', 'st.ACTIVE': 'Active', 'st.SUSPENDED': 'Suspended',
    'plan.trial': 'Free trial · {n} days left', 'plan.pro': 'Pro · {n} days left', 'plan.expired': 'Paused · upgrade needed',
    langLabel: 'Switch language', calLabel: 'Switch calendar (Gregorian / Ethiopian)',
  },
  am: {
    'nav.how': 'እንዴት እንደሚሰራ', 'nav.features': 'ባህሪያት', 'nav.pricing': 'ዋጋ', 'nav.faq': 'ተደጋጋሚ ጥያቄዎች',
    signIn: 'ግባ', signOut: 'ውጣ', profile: 'መገለጫ', admin: 'አስተዳዳሪ', startTrial: 'ነፃ ሙከራ ጀምር', startTrialLong: 'ነፃ ሙከራዎን ይጀምሩ',
    seeHow: 'እንዴት እንደሚሰራ ይመልከቱ', openDashboard: 'ዳሽቦርድ ክፈት', tagline: 'ያስተዳድሩ። ያዋጡ። በአንድ ላይ ያድጉ።',
    heroSub: 'እቁብዎን ለመምራት ቀላልና አስተማማኝ መንገድ። እያንዳንዱን ወርሃዊ መዋጮ ይከታተሉ፣ ደረሰኞችን ያረጋግጡ፣ መላው ቡድንዎም በአንድ ገጽ ላይ ይሁን።',
    welcomeBack: 'እንኳን ደህና መጡ', welcomeSub: 'እቁብዎንና መዋጮዎን ለማየት ይግቡ።', email: 'ኢሜይል', password: 'የይለፍ ቃል',
    forgot: 'የይለፍ ቃል ረስተዋል?', createAccount: 'መለያ ክፈት', signingIn: 'በመግባት ላይ…',
    signupTitle: 'መለያዎን ይፍጠሩ', signupSub: 'እቁብ ይቀላቀሉ ወይም ቡድንዎን ያደራጁ።', fullName: 'ሙሉ ስም', phoneOpt: 'ስልክ (አማራጭ)', creating: 'መለያ በመፍጠር ላይ…',
    hello: 'ሰላም', myEqubs: 'የእኔ እቁቦች', findEqub: 'እቁብ ፈልግ', requestJoin: 'ለመቀላቀል ጠይቅ', open: 'ክፈት',
    month: 'ወር', search: 'ፈልግ', status: 'ሁኔታ', members: 'አባላት', announcements: 'ማስታወቂያዎች', reports: 'ሪፖርቶች', myHistory: 'የእኔ ታሪክ (PDF)',
    createRecords: 'የዚህ ወር መዝገቦችን ፍጠር', uploadReceipt: 'ደረሰኝ ጫን', viewReceipt: 'ደረሰኝ እይ', verify: 'አረጋግጥ', reject: 'ውድቅ አድርግ',
    approve: 'ፍቀድ', suspend: 'አግድ', reactivate: 'መልስ', remove: 'አስወግድ', expected: 'የሚጠበቀው', awaiting: 'ግምገማ በመጠበቅ ላይ',
    invite: 'የመጋበዣ ሊንክ ፍጠር', addMember: 'አባል ጨምር', addByEmail: 'በኢሜይል ጨምር',
    'st.VERIFIED': 'ተረጋግጧል', 'st.SUBMITTED': 'ገብቷል', 'st.PENDING': 'በመጠባበቅ ላይ', 'st.REJECTED': 'ውድቅ ሆኗል', 'st.OVERDUE': 'ዘግይቷል', 'st.ACTIVE': 'ንቁ', 'st.SUSPENDED': 'ታግዷል',
    'plan.trial': 'ነፃ ሙከራ · {n} ቀን ቀርቷል', 'plan.pro': 'Pro · {n} ቀን ቀርቷል', 'plan.expired': 'ቆሟል · ማሻሻል ያስፈልጋል',
    langLabel: 'ቋንቋ ቀይር', calLabel: 'የቀን መቁጠሪያ ቀይር (ግሪጎሪያን / ኢትዮጵያ)',
  },
};

type Ctx = { lang: Lang; cal: Cal; setLang: (l: Lang) => void; setCal: (c: Cal) => void; t: (k: string, v?: Record<string, string | number>) => string; fmtDate: (d?: string | number | Date | null) => string };
const PrefsCtx = createContext<Ctx | null>(null);

const read = <T extends string>(key: string, allowed: T[], fallback: T): T => {
  try { const v = localStorage.getItem(key) as T | null; return v && allowed.includes(v) ? v : fallback; } catch { return fallback; }
};

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => read('eh-lang', ['en', 'am'], 'en'));
  const [cal, setCalState] = useState<Cal>(() => read('eh-cal', ['GC', 'EC'], 'GC'));
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem('eh-lang', l); } catch { /* storage unavailable */ } };
  const setCal = (c: Cal) => { setCalState(c); try { localStorage.setItem('eh-cal', c); } catch { /* storage unavailable */ } };
  const t = useCallback((k: string, v?: Record<string, string | number>) => {
    let s = dict[lang][k] ?? dict.en[k] ?? k;
    if (v) for (const [name, val] of Object.entries(v)) s = s.replace(`{${name}}`, String(val));
    return s;
  }, [lang]);
  const fmtDate = useCallback((d?: string | number | Date | null) => {
    if (!d) return '';
    const date = new Date(d);
    if (Number.isNaN(+date)) return '';
    if (cal === 'EC') return formatEthiopian(date, lang);
    return date.toLocaleDateString(lang === 'am' ? 'am-ET' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [cal, lang]);
  const value = useMemo(() => ({ lang, cal, setLang, setCal, t, fmtDate }), [lang, cal, t, fmtDate]);
  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}

export const usePrefs = () => { const c = useContext(PrefsCtx); if (!c) throw new Error('usePrefs outside PrefsProvider'); return c; };
export const useT = () => usePrefs().t;
