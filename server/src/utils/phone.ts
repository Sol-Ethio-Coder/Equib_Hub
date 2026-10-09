/** Normalise phone numbers to E.164. Defaults to Ethiopia (+251) for local formats like 0911223344 or 0711223344. */
const DEFAULT_DIAL = '251';

export function normalizePhone(input: string, dial = DEFAULT_DIAL): string | null {
  const digits = input.replace(/[\s\-().]/g, '');
  let n: string;
  if (digits.startsWith('+')) n = digits.slice(1);
  else if (digits.startsWith('00')) n = digits.slice(2);
  else if (digits.startsWith('0')) n = dial + digits.slice(1);
  else if (digits.startsWith(dial)) n = digits;
  else n = dial + digits;
  if (!/^\d{8,15}$/.test(n)) return null;
  // Ethiopian mobile numbers: +251 9XXXXXXXX or +251 7XXXXXXXX
  if (n.startsWith('251') && !/^251[79]\d{8}$/.test(n)) return null;
  return '+' + n;
}
