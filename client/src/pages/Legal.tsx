import { Link } from 'react-router-dom';
import { ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Footer } from '@/components/Footer';
import { brand } from '@/config/brand';

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4"><Link to="/"><Logo /></Link><ThemeToggle /></header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted">Initial version · {brand.name} is an Equb management tool. It is not a bank or financial institution and does not hold or move money.</p>
        <div className="mt-6 space-y-6 leading-relaxed [&_h2]:mb-1 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

export function PrivacyPage() {
  return (
    <Page title="Privacy Policy">
      <section><h2>What we collect</h2><p>Your name, email, optional phone number, optional profile details, your Equb memberships, payment records, and the receipt images or PDFs you upload.</p></section>
      <section><h2>Why we collect it</h2><p>To run your Equb: identify members, track monthly contributions, let leaders verify payments, and send you notifications about your own account and group.</p></section>
      <section><h2>How receipts are handled</h2><p>Receipts are stored privately and are never public links. Each one is served only to its uploader, the leaders of that Equb, and platform administrators, after sign-in.</p></section>
      <section><h2>Who can see your information</h2><ul><li>You can see your own profile, payments and receipts.</li><li>Equb leaders can see members and payments of their own group only.</li><li>Super Admins can see platform-wide records for support and safety. Their administrative actions are logged.</li></ul></section>
      <section><h2>Security</h2><p>Passwords are hashed and never stored in plain text. Sessions use secure cookies, access is role-based, and uploads are checked for type and size.</p></section>
      <section><h2>Your rights</h2><p>You can ask to view, correct, or delete your personal information by contacting your Equb leader or the platform operator. Some financial records may need to be kept so your group's history stays accurate.</p></section>
      <section><h2>Retention</h2><p>We keep your data while your account is active and for as long as your Equb needs its records. Deleted accounts are removed or anonymised, except records the group still needs.</p></section>
      <p className="text-sm text-muted">This is a plain-language draft. Have a lawyer review it before public launch.</p>
    </Page>
  );
}

export function TermsPage() {
  return (
    <Page title="Terms & Conditions">
      <section><h2>What the service is</h2><p>{brand.name} helps Equb groups record contributions and verify receipts. Payments are made outside the platform. We do not hold funds, guarantee payouts, or act as a bank.</p></section>
      <section><h2>Your account</h2><p>Keep your password private and provide accurate information. You are responsible for activity on your account.</p></section>
      <section><h2>Leaders and members</h2><p>Leaders decide who joins and verify payments for their group. Disputes about money are between group members and their leader.</p></section>
      <section><h2>Acceptable use</h2><p>Do not upload false or altered receipts, access other people's data, or attempt to disrupt the service. Accounts that break these rules may be suspended.</p></section>
      <section><h2>Changes and liability</h2><p>The service is provided as is during this early version. We may update these terms and will show the latest version here.</p></section>
      <p className="text-sm text-muted">This is a plain-language draft. Have a lawyer review it before public launch.</p>
    </Page>
  );
}
