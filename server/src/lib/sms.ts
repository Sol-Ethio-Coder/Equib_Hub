import { env } from '../config/env.js';

/** Optional SMS via Africa's Talking. Off unless SMS_DRIVER=africastalking. Never throws. */
export async function sendSms(to: string, message: string) {
  if (env.SMS_DRIVER !== 'africastalking' || !env.AT_USERNAME || !env.AT_API_KEY) return;
  try {
    const body = new URLSearchParams({ username: env.AT_USERNAME, to, message, ...(env.AT_SENDER ? { from: env.AT_SENDER } : {}) });
    const r = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST', headers: { apiKey: env.AT_API_KEY, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    if (!r.ok) console.error('SMS failed:', r.status, await r.text());
  } catch (e) { console.error('SMS failed:', e instanceof Error ? e.message : e); }
}
