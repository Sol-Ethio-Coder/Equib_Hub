import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { brand } from '@/config/brand';

const col = 'text-sm text-white/65 transition hover:text-white';
const head = 'mb-3 text-xs font-semibold uppercase tracking-widest text-gold';

export function Footer() {
  const dev = brand.developer;
  return (
    <footer className="mt-auto bg-[#052A25] text-white dark:bg-[#040F0D]">
      <div className="h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <div className="text-white"><Logo size={34} /></div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">{brand.tagline} A clear, trusted record for every Equb: who paid, what was verified, and what is still due.</p>
        </div>
        <nav aria-label="Product">
          <h3 className={head}>Product</h3>
          <ul className="space-y-2.5">
            <li><a className={col} href="/#how">How it works</a></li><li><a className={col} href="/#features">Features</a></li>
            <li><a className={col} href="/#pricing">Pricing</a></li><li><a className={col} href="/#faq">FAQ</a></li>
          </ul>
        </nav>
        <nav aria-label="Account">
          <h3 className={head}>Account</h3>
          <ul className="space-y-2.5">
            <li><Link className={col} to="/signup">Start free trial</Link></li><li><Link className={col} to="/login">Sign in</Link></li>
            <li><Link className={col} to="/forgot-password">Reset password</Link></li>
          </ul>
        </nav>
        <nav aria-label="Legal and contact">
          <h3 className={head}>Company</h3>
          <ul className="space-y-2.5">
            <li><Link className={col} to="/privacy">Privacy Policy</Link></li><li><Link className={col} to="/terms">Terms &amp; Conditions</Link></li>
            <li><a className={col} href={dev.url} target="_blank" rel="noreferrer">Contact</a></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-sm text-white/60">
          <p>© {new Date().getFullYear()} {brand.name}. {brand.name} manages Equb records. It is not a bank.</p>
          <a href={dev.url} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-2 transition hover:text-white" aria-label={`Developed by ${dev.name} (opens portfolio)`}>
            <span>Developed by</span>
            <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-[13px] text-gold transition group-hover:border-gold/60">&lt;{dev.name} /&gt;</span>
          </a>
        </div>
        <p className="mx-auto max-w-6xl px-5 pb-5 text-xs text-white/40">{dev.role}</p>
      </div>
    </footer>
  );
}
