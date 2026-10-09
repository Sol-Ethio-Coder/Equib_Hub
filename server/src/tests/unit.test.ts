import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from '../utils/phone.js';
import { planOf } from '../lib/plan.js';
import { sniff } from '../lib/filetype.js';

const day = 86_400_000;

test('Ethiopian phone numbers normalise to E.164', () => {
  assert.equal(normalizePhone('0911 22 33 44'), '+251911223344');
  assert.equal(normalizePhone('+251711223344'), '+251711223344');
  assert.equal(normalizePhone('251911223344'), '+251911223344');
  assert.equal(normalizePhone('0211234567'), null); // landline is not a mobile
  assert.equal(normalizePhone('abc'), null);
});

test('plan: trial, pro and expired', () => {
  assert.equal(planOf({ trialEndsAt: new Date(Date.now() + 3 * day) }).state, 'TRIAL');
  assert.equal(planOf({ trialEndsAt: new Date(Date.now() - day), proUntil: new Date(Date.now() + 10 * day) }).state, 'PRO');
  const expired = planOf({ trialEndsAt: new Date(Date.now() - day) });
  assert.equal(expired.state, 'EXPIRED');
  assert.equal(expired.active, false);
  assert.equal(planOf({}).active, false);
});

test('file type is detected from content, not from the name', () => {
  assert.equal(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.mime, 'image/jpeg');
  assert.equal(sniff(Buffer.from('%PDF-1.7 ...'))?.mime, 'application/pdf');
  assert.equal(sniff(Buffer.from('<script>alert(1)</script>')), null);
  assert.equal(sniff(Buffer.from('MZ executable')), null);
});
