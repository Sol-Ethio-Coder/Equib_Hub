import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Footer } from '@/components/Footer';
import { brand } from '@/config/brand';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/lib/i18n';
import { PrefsToggle } from '@/components/PrefsToggle';

const { trialDays, proPriceEtb } = brand.pricing;

function Ring() {
  // A rotating Equb: members around a circle, one receives the pot each round.
  const dots = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 - Math.PI / 2; return { x: 150 + 110 * Math.cos(a), y: 150 + 110 * Math.sin(a), i }; });
  return (
    <svg viewBox="0 0 300 300" className="mx-auto w-full max-w-sm" aria-hidden="true">
      <circle cx="150" cy="150" r="110" fill="none" stroke="rgb(var(--line))" strokeWidth="2" strokeDasharray="3 7" />
      <g className="ring-spin">{dots.map((d) => <circle key={d.i} cx={d.x} cy={d.y} r={d.i === 0 ? 14 : 10} fill={d.i === 0 ? 'rgb(var(--gold))' : 'rgb(var(--brand))'} opacity={d.i === 0 ? 1 : 0.55} />)}</g>
      <circle cx="150" cy="150" r="52" fill="rgb(var(--surface))" stroke="rgb(var(--line))" />
      <text x="150" y="146" textAnchor="middle" className="fill-muted" fontSize="12">This round</text>
      <text x="150" y="168" textAnchor="middle" className="fill-ink font-display" fontSize="20" fontWeight="700">ETB 50,000</text>
    </svg>
  );
}

const Icon = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const Section = ({ id, kicker, title, intro, children }: { id: string; kicker: string; title: string; intro?: string; children: ReactNode }) => (
  <section id={id} className="scroll-mt-20 py-16 md:py-24">
    <div className="mx-auto max-w-6xl px-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gold">{kicker}</p>
      <h2 className="mt-2 max-w-2xl text-3xl font-bold md:text-4xl">{title}</h2>
      {intro && <p className="mt-3 max-w-2xl text-lg text-muted">{intro}</p>}
      <div className="mt-10">{children}</div>
    </div>
  </section>
);

const steps = [
  ['1', 'Start your Equb', `Create a group in a minute: name, contribution in ETB, number of members. Your ${trialDays}-day free trial starts right away.`],
  ['2', 'Invite and approve', 'Members sign up and request to join. You approve each one, so only the right people are in your group.'],
  ['3', 'Contribute and upload', 'Each month members pay by Telebirr, CBE Birr or bank, then upload the receipt photo from their phone.'],
  ['4', 'Verify with confidence', 'You open the receipt, verify or reject it with a reason, and everyone sees the same clear status.'],
];
const features = [
  ['Receipt verification', 'Members upload screenshots or PDFs. Leaders zoom in, verify or reject with a reason.', 'M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z'],
  ['Monthly tracking', 'See who paid, who is pending and who is overdue for any month, with search and filters.', 'M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z'],
  ['Many groups, one account', 'Lead one Equb and join another with the same login. Each group stays separate.', 'M17 20h5v-2a4 4 0 00-5-3.9M9 11a4 4 0 100-8 4 4 0 000 8zm-7 9v-2a4 4 0 014-4h6a4 4 0 014 4v2'],
  ['Instant notifications', 'Members hear when a receipt is verified or rejected. Leaders see new uploads straight away.', 'M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0'],
  ['Reports you can share', 'Export the monthly contribution list to CSV for your records or your group chat.', 'M12 3v12m0 0l-4-4m4 4l4-4M4 21h16'],
  ['Made for Ethiopia', 'Amounts in Birr, Ethiopian phone numbers, Telebirr and CBE Birr, and a design that works on any phone.', 'M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11zm0-8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z'],
];
const faqs = [
  ['How does the free trial work?', `Every new Equb gets ${trialDays} days with every feature, and no payment is needed to start. Each person gets one free trial. After it ends, the group pauses until the leader upgrades to Pro. Nothing is deleted.`],
  ['What does Pro cost?', `Pro is ETB ${proPriceEtb.toLocaleString()} per month for each Equb group. It is billed per group, not per member, so a bigger group does not cost more.`],
  ['How do I pay for Pro?', 'You send the payment by Telebirr, CBE Birr or bank transfer and upload the receipt on the billing page. Our team verifies it and turns Pro on, usually within a day.'],
  ['What happens if I do not upgrade?', 'The group pauses. Members and leaders cannot use payments or receipts, but all records stay safe. When you upgrade, everything comes back as it was.'],
  ['Does EquibHub hold our money?', 'No. EquibHub is a record-keeping tool, not a bank. Members pay each other or the group leader the way they already do, and the platform tracks and verifies it.'],
  ['Who can see my receipts?', 'Only you, the leaders of your group and platform administrators. Receipts are never public links.'],
  ['Can I use it on my phone?', 'Yes. EquibHub is designed for phones first, and it also works on tablets and computers, in light or dark mode.'],
];

export default function Home() {
  const { me } = useAuth();
  const t = useT();
  const cta = me ? <Link to="/app" className="btn-primary">{t('openDashboard')}</Link> : <Link to="/signup" className="btn-primary hidden sm:inline-flex">{t('startTrial')}</Link>;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3">
          <Link to="/" aria-label={`${brand.name} home`}><Logo /></Link>
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex" aria-label="Main">
            <a className="hover:text-ink" href="#how">{t('nav.how')}</a><a className="hover:text-ink" href="#features">{t('nav.features')}</a>
            <a className="hover:text-ink" href="#pricing">{t('nav.pricing')}</a><a className="hover:text-ink" href="#faq">{t('nav.faq')}</a>
          </nav>
          <div className="flex items-center gap-2"><PrefsToggle /><ThemeToggle />{!me && <Link to="/login" className="btn-ghost">{t('signIn')}</Link>}{cta}</div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-brand/15 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 md:grid-cols-2 md:py-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-muted"><span className="h-2 w-2 rounded-full bg-brand" />{trialDays}-day free trial · No payment to start</p>
              <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-6xl">{t('tagline')}</h1>
              <p className="mt-5 max-w-lg text-lg text-muted">{t('heroSub')}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={me ? '/app' : '/signup'} className="btn-primary !px-6 !py-3 text-base">{me ? t('openDashboard') : t('startTrialLong')}</Link>
                <a href="#how" className="btn-ghost !px-6 !py-3 text-base">{t('seeHow')}</a>
              </div>
              <p className="mt-4 text-sm text-muted">Then ETB {proPriceEtb.toLocaleString()} per month for each Equb group.</p>
            </div>
            <div className="relative">
              <Ring />
              <div className="card absolute -bottom-6 left-0 w-60 p-3 shadow-xl sm:left-4" aria-hidden="true">
                <p className="mb-2 text-xs font-semibold text-muted">October contributions · sample</p>
                {[['Dawit', 'Verified', 'bg-brand/15 text-brand'], ['Selam', 'Submitted', 'bg-gold/20 text-gold'], ['Mulu', 'Overdue', 'bg-danger/15 text-danger']].map(([n, s, c]) => (
                  <div key={n} className="flex items-center justify-between py-1 text-sm"><span>{n}</span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>{s}</span></div>))}
              </div>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <div className="border-y border-line bg-surface">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-5 py-6 text-center text-sm font-medium md:grid-cols-4">
            {['Amounts in Ethiopian Birr', 'Telebirr · CBE Birr · Bank', 'Works on any phone', 'Private, role-based access'].map((t) => <li key={t} className="text-muted">{t}</li>)}
          </ul>
        </div>

        <Section id="how" kicker="How Equb works here" title="From first contribution to verified in four steps" intro="An Equb runs on trust. EquibHub keeps that trust visible, so nobody has to chase screenshots in a chat group.">
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([n, t, d]) => (
              <li key={n} className="card p-6"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-bold text-brand-ink">{n}</span><h3 className="mt-4 text-lg font-semibold">{t}</h3><p className="mt-2 text-sm text-muted">{d}</p></li>))}
          </ol>
        </Section>

        <Section id="features" kicker="Features" title="Everything your Equb needs, nothing it doesn't" intro="Built for real groups: a workplace, a neighbourhood, a family.">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([t, d, icon]) => (
              <div key={t} className="card p-6 transition hover:-translate-y-0.5 hover:border-brand"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand"><Icon d={icon} /></span><h3 className="mt-4 font-semibold">{t}</h3><p className="mt-2 text-sm text-muted">{d}</p></div>))}
          </div>
        </Section>

        <Section id="benefits" kicker="Benefits" title="Less chasing. More trust.">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="card p-7"><h3 className="text-xl font-semibold">For Equb leaders</h3><ul className="mt-4 space-y-3 text-muted">
              {['See who has paid at a glance, with no spreadsheets', 'Verify receipts in seconds and give clear reasons when you reject', 'Approve who joins and suspend or remove with confirmation', 'Export a monthly report whenever the group asks'].map((t) => <li key={t} className="flex gap-3"><span className="mt-1 text-brand">✓</span>{t}</li>)}</ul></div>
            <div className="card p-7"><h3 className="text-xl font-semibold">For members</h3><ul className="mt-4 space-y-3 text-muted">
              {['Upload your receipt from your phone in a few taps', 'See right away if it was verified or needs fixing', 'Keep your own payment history, always available', 'Your receipts stay private, visible only to your leaders'].map((t) => <li key={t} className="flex gap-3"><span className="mt-1 text-brand">✓</span>{t}</li>)}</ul></div>
          </div>
        </Section>

        <section id="security" className="scroll-mt-20 bg-[#052A25] py-16 text-white md:py-20 dark:bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-2">
            <div><p className="text-xs font-semibold uppercase tracking-widest text-gold">Security</p><h2 className="mt-2 text-3xl font-bold md:text-4xl">Your group's money records deserve real protection</h2>
              <p className="mt-4 text-white/70">EquibHub tracks records and never holds your money. We protect what it does store with the same care you would expect from a serious financial tool.</p></div>
            <ul className="grid gap-3 text-sm sm:grid-cols-2">
              {['Passwords are hashed, never stored as text', 'Role-based access: members, leaders, admins', 'Receipts are private and checked on upload', 'Admin actions are recorded in an audit log', 'Secure, expiring sessions', 'No public links to your data'].map((t) => <li key={t} className="rounded-xl border border-white/10 bg-white/5 p-4">{t}</li>)}
            </ul>
          </div>
        </section>

        <Section id="pricing" kicker="Pricing" title={`Try it free for a month. Keep it for ETB ${proPriceEtb.toLocaleString()} a month.`} intro="One simple price for each Equb group. Pay by Telebirr, CBE Birr or bank transfer.">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="card flex flex-col p-8"><h3 className="text-xl font-semibold">Free trial</h3><p className="mt-3 font-display text-4xl font-bold">ETB 0</p><p className="text-sm text-muted">for {trialDays} days</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-muted">{['Every feature included', 'No payment to start', 'Create your Equb in a minute', 'One free trial per person'].map((t) => <li key={t} className="flex gap-3"><span className="text-brand">✓</span>{t}</li>)}</ul>
              <Link to={me ? '/app' : '/signup'} className="btn-ghost mt-8">Start free trial</Link></div>
            <div className="card relative flex flex-col border-brand p-8 ring-1 ring-brand"><span className="absolute -top-3 right-6 rounded-full bg-gold px-3 py-1 text-xs font-bold text-bg">Pro</span>
              <h3 className="text-xl font-semibold">Pro</h3><p className="mt-3 font-display text-4xl font-bold">ETB {proPriceEtb.toLocaleString()}</p><p className="text-sm text-muted">per month, for each Equb group</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-muted">{['Everything in the trial, without a time limit', 'Priced per group, not per member', 'Pay 1, 3, 6 or 12 months at a time', 'Group pauses (never deleted) if Pro ends'].map((t) => <li key={t} className="flex gap-3"><span className="text-brand">✓</span>{t}</li>)}</ul>
              <Link to={me ? '/app' : '/signup'} className="btn-primary mt-8">Start free, upgrade later</Link></div>
          </div>
        </Section>

        <Section id="faq" kicker="FAQ" title="Questions people ask">
          <div className="max-w-3xl space-y-3">
            {faqs.map(([q, a]) => (
              <details key={q} className="card group p-5 open:border-brand"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">{q}<span className="text-brand transition group-open:rotate-45" aria-hidden="true">+</span></summary><p className="mt-3 text-muted">{a}</p></details>))}
          </div>
        </Section>

        <section className="px-5 pb-20">
          <div className="mx-auto max-w-6xl rounded-3xl bg-gradient-to-br from-[#14877B] to-[#063A33] px-6 py-14 text-center text-white md:py-20">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold md:text-4xl">Bring clarity to your Equb this month</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/80">Start your {trialDays}-day free trial. No payment needed, and your group can be set up in minutes.</p>
            <Link to={me ? '/app' : '/signup'} className="mt-8 inline-flex rounded-xl bg-white px-7 py-3 font-semibold text-[#063A33] transition hover:bg-gold">{me ? 'Open dashboard' : 'Start your free trial'}</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
