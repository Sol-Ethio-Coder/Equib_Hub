import { usePrefs } from '@/lib/i18n';

/** Language (English / አማርኛ) and calendar (Gregorian / Ethiopian) switches. Choices are remembered. */
export function PrefsToggle() {
  const { lang, setLang, cal, setCal, t } = usePrefs();
  return (
    <div className="flex items-center gap-1">
      <button className="btn-ghost !px-2.5 !py-2 text-xs" onClick={() => setLang(lang === 'en' ? 'am' : 'en')} aria-label={t('langLabel')} title={t('langLabel')}>{lang === 'en' ? 'አማ' : 'EN'}</button>
      <button className="btn-ghost !px-2.5 !py-2 text-xs" onClick={() => setCal(cal === 'GC' ? 'EC' : 'GC')} aria-label={t('calLabel')} title={t('calLabel')}>{cal === 'GC' ? 'GC' : 'EC'}</button>
    </div>
  );
}
