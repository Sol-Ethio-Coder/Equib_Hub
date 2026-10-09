import { env } from '../config/env.js';

export interface Mail { to: string; subject: string; text: string }
interface Driver { send(mail: Mail): Promise<void> }

const consoleDriver: Driver = {
  async send(m) { console.log(`\n--- EMAIL (${env.MAIL_FROM}) ---\nTo: ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n---------------\n`); },
};

// Resend (https://resend.com): one API key, no extra package.
const resendDriver: Driver = {
  async send(m) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [m.to], subject: m.subject, text: m.text }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  },
};

// Any SMTP server (Gmail app password, Brevo, Mailgun, your own).
const smtpDriver: Driver = {
  async send(m) {
    const nodemailer = (await import('nodemailer')).default;
    const t = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE === 'true', auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined });
    await t.sendMail({ from: env.MAIL_FROM, to: m.to, subject: m.subject, text: m.text });
  },
};

const driver = env.MAIL_DRIVER === 'smtp' ? smtpDriver : env.MAIL_DRIVER === 'resend' ? resendDriver : consoleDriver;

/** Never throws: a mail outage must not break sign-up or payments. */
export const mailer = {
  async send(m: Mail) { try { await driver.send(m); } catch (e) { console.error('Email failed:', e instanceof Error ? e.message : e); } },
};
