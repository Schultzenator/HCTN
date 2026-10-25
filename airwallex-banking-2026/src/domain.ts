import { z } from 'zod';
import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';

// Explicit supported exponents. Never silently assume all currencies have cents.
export const exponents = { USD: 2, EUR: 2, GBP: 2, PLN: 2, AUD: 2, SGD: 2, HKD: 2, CAD: 2, CHF: 2, JPY: 0, KWD: 3 } as const;
export const currency = z.enum(Object.keys(exponents) as [keyof typeof exponents, ...(keyof typeof exponents)[]]);
export type Currency = z.infer<typeof currency>;
export const minor = z.string().regex(/^(0|[1-9]\d{0,14})$/);
export const instant = z.string().datetime({ offset: true }).refine(v => Number.isFinite(Date.parse(v)), 'Timestamp must be a real instant');
export const intentSchema = z.object({
  version: z.literal(1), id: z.string().uuid(), budgetMinor: minor, baseCurrency: currency,
  targetCurrency: currency, merchants: z.array(z.string().min(1).max(100)).min(1).max(100),
  expiresAt: instant, humanAboveMinor: minor.optional(), feeReserveMinor: minor.default('0')
}).strict().superRefine((v, ctx) => {
  if (v.budgetMinor === '0') ctx.addIssue({ code: 'custom', message: 'Budget must be positive' });
});
export const signedSchema = z.object({ intent: intentSchema, signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/) }).strict();
export const purchaseSchema = z.object({
  id: z.string().uuid(), merchant: z.string().min(1).max(100), amountMinor: minor.refine(v => v !== '0'),
  currency, rail: z.enum(['card', 'payout'])
}).strict();
export const quoteSchema = z.object({
  id: z.string().min(1), baseCurrency: currency, targetCurrency: currency,
  targetMinor: minor, baseMinor: minor, validFrom: instant, expiresAt: instant, locked: z.literal(true)
}).strict();
export type Intent = z.infer<typeof intentSchema>;
export type SignedIntent = z.infer<typeof signedSchema>;
export type Purchase = z.infer<typeof purchaseSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function signIntent(intent: Intent, key: KeyObject | string): SignedIntent {
  const parsed = intentSchema.parse(intent);
  const privateKey = typeof key === 'string' ? createPrivateKey(key) : key;
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('Intent signing requires Ed25519');
  return { intent: parsed, signature: sign(null, Buffer.from(canonical(parsed)), privateKey).toString('base64') };
}
export function verifyIntent(envelope: SignedIntent, trustedKey: KeyObject | string): boolean {
  try {
    const publicKey = typeof trustedKey === 'string' ? createPublicKey(trustedKey) : trustedKey;
    return publicKey.asymmetricKeyType === 'ed25519' && verify(null, Buffer.from(canonical(envelope.intent)), publicKey, Buffer.from(envelope.signature, 'base64'));
  } catch { return false; }
}
export function decimalToMinor(amount: string | number, code: Currency): string {
  const s = String(amount);
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('Invalid decimal amount');
  const [whole = '0', fraction = ''] = s.split('.');
  const places = exponents[code];
  const scale = 10n ** BigInt(places);
  // Round costs UP, never accidentally authorize a fractional cent over budget.
  const tail = fraction.slice(places);
  return (BigInt(whole) * scale + BigInt(fraction.slice(0, places).padEnd(places, '0') || '0') + (/[1-9]/.test(tail) ? 1n : 0n)).toString();
}
export function minorToDecimal(amount: string, code: Currency): string {
  minor.parse(amount);
  const places = exponents[code];
  if (!places) return amount;
  const s = amount.padStart(places + 1, '0');
  return s.slice(0, -places) + '.' + s.slice(-places);
}
export type DecisionCode = 'APPROVE' | 'NEEDS_HUMAN_APPROVAL' | `REJECT_${string}`;
export interface Decision { code: DecisionCode; reason: string; costMinor?: string; remainingMinor?: string }
// Pure, deterministic, no IO and no model. Trust comes from a configured owner key, never from a caller's envelope.
export function checkPolicy(envelope: unknown, purchase: unknown, quote: unknown, trustedKey: KeyObject | string, now: number, spentMinor = '0'): Decision {
  const e = signedSchema.safeParse(envelope), p = purchaseSchema.safeParse(purchase), q = quoteSchema.safeParse(quote);
  const reject = (reason: string): Decision => ({ code: `REJECT_${reason}`, reason });
  if (!e.success || !p.success || !Number.isFinite(now) || !minor.safeParse(spentMinor).success) return reject('INVALID_INPUT');
  if (!verifyIntent(e.data, trustedKey)) return reject('INVALID_SIGNATURE');
  const i = e.data.intent, r = p.data;
  if (Date.parse(i.expiresAt) <= now) return reject('EXPIRED');
  if (!i.merchants.includes(r.merchant)) return reject('MERCHANT_NOT_ALLOWED');
  if (i.targetCurrency !== r.currency) return reject('CURRENCY_MISMATCH');
  if (!q.success) return reject('INVALID_QUOTE');
  const fx = q.data;
  if (fx.baseCurrency !== i.baseCurrency || fx.targetCurrency !== r.currency || fx.targetMinor !== r.amountMinor || BigInt(fx.baseMinor) <= 0n) return reject('QUOTE_MISMATCH');
  if (Date.parse(fx.expiresAt) <= now || Date.parse(fx.validFrom) > now) return reject('QUOTE_EXPIRED');
  const cost = BigInt(fx.baseMinor) + BigInt(i.feeReserveMinor), remaining = BigInt(i.budgetMinor) - BigInt(spentMinor);
  if (cost > remaining) return { ...reject('BUDGET_EXCEEDED'), costMinor: cost.toString(), remainingMinor: remaining.toString() };
  if (i.humanAboveMinor !== undefined && cost > BigInt(i.humanAboveMinor)) return { code: 'NEEDS_HUMAN_APPROVAL', reason: 'OWNER_THRESHOLD', costMinor: cost.toString(), remainingMinor: remaining.toString() };
  return { code: 'APPROVE', reason: 'WITHIN_SIGNED_ENVELOPE', costMinor: cost.toString(), remainingMinor: (remaining - cost).toString() };
}
