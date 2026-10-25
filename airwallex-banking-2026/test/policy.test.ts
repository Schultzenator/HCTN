import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import { canonical, checkPolicy, decimalToMinor, minorToDecimal, signIntent, signedSchema, verifyIntent, type Quote } from '../src/domain.js';
import { demoKey, fixtureIntent, fixturePurchase } from '../src/fixtures.js';
import { DEMO_NOW } from '../src/mock.js';
const key = createPublicKey(demoKey), envelope = signIntent(fixtureIntent, demoKey);
const quote: Quote = { id: 'q1', baseCurrency: 'USD', targetCurrency: 'EUR', baseMinor: '12000', targetMinor: '10800', validFrom: '2026-10-27T12:00:00Z', expiresAt: '2026-10-27T12:01:00Z', locked: true };
const check = (e: unknown = envelope, p: unknown = fixturePurchase, q: unknown = quote, now = DEMO_NOW, spent = '0') => checkPolicy(e, p, q, key, now, spent);
test('exact FX-aware budget boundary and cumulative cap', () => {
  assert.equal(check().code, 'APPROVE');
  assert.equal(check(envelope, fixturePurchase, { ...quote, baseMinor: '15000' }).code, 'APPROVE');
  assert.equal(check(envelope, fixturePurchase, { ...quote, baseMinor: '15001' }).code, 'REJECT_BUDGET_EXCEEDED');
  assert.equal(check(envelope, fixturePurchase, quote, DEMO_NOW, '3000').code, 'APPROVE');
  assert.equal(check(envelope, fixturePurchase, quote, DEMO_NOW, '3001').code, 'REJECT_BUDGET_EXCEEDED');
});
test('owner signature is mandatory and binds every field', () => {
  for (const changed of [{ budgetMinor: '20000' }, { merchants: ['evil'] }, { expiresAt: '2099-01-01T00:00:00Z' }, { feeReserveMinor: '1' }, { targetCurrency: 'GBP' }]) assert.equal(check({ ...envelope, intent: { ...envelope.intent, ...changed } }).code, 'REJECT_INVALID_SIGNATURE');
  assert.equal(check(signIntent(fixtureIntent, generateKeyPairSync('ed25519').privateKey)).code, 'REJECT_INVALID_SIGNATURE');
  assert.equal(check({ ...envelope, publicKey: key.export({ type: 'spki', format: 'pem' }) }).code, 'REJECT_INVALID_INPUT');
});
test('canonical signatures survive object key order', () => {
  const reordered = Object.fromEntries(Object.entries(envelope.intent).reverse());
  assert.equal(check({ ...envelope, intent: reordered }).code, 'APPROVE');
  assert.equal(canonical({ b: 2, a: [1, 3] }), '{"a":[1,3],"b":2}');
});
test('merchant matching is exact and currency cannot change', () => {
  for (const merchant of ['MONITOR-STORE', 'monitor-store ', 'evil-store']) assert.equal(check(envelope, { ...fixturePurchase, merchant }).code, 'REJECT_MERCHANT_NOT_ALLOWED');
  assert.equal(check(envelope, { ...fixturePurchase, currency: 'JPY' }).code, 'REJECT_CURRENCY_MISMATCH');
});
test('expiry is exclusive, uses absolute instants across DST offsets', () => {
  assert.equal(check(envelope, fixturePurchase, quote, Date.parse(fixtureIntent.expiresAt)).code, 'REJECT_EXPIRED');
  const offset = signIntent({ ...fixtureIntent, expiresAt: '2026-10-27T14:00:00+02:00' }, demoKey);
  assert.equal(check(offset).code, 'REJECT_EXPIRED');
  const dst = signIntent({ ...fixtureIntent, expiresAt: '2026-10-25T02:30:00+01:00' }, demoKey);
  assert.equal(check(dst, fixturePurchase, quote, Date.parse('2026-10-25T01:30:00Z')).code, 'REJECT_EXPIRED');
  assert.equal(signedSchema.safeParse({ ...envelope, intent: { ...fixtureIntent, expiresAt: '2026-10-27T13:00:00' } }).success, false);
});
test('quote is locked, bound to pair and amount, and fresh', () => {
  for (const changed of [{ baseCurrency: 'GBP' }, { targetMinor: '10801' }, { targetCurrency: 'JPY' }, { baseMinor: '0' }]) assert.equal(check(envelope, fixturePurchase, { ...quote, ...changed }).code, 'REJECT_QUOTE_MISMATCH');
  assert.equal(check(envelope, fixturePurchase, { ...quote, locked: false }).code, 'REJECT_INVALID_QUOTE');
  assert.equal(check(envelope, fixturePurchase, quote, Date.parse(quote.expiresAt)).code, 'REJECT_QUOTE_EXPIRED');
  assert.equal(check(envelope, fixturePurchase, { ...quote, validFrom: '2026-10-27T12:00:01Z' }).code, 'REJECT_QUOTE_EXPIRED');
  assert.equal(check(envelope, fixturePurchase, { ...quote, expiresAt: 'invalid' }).code, 'REJECT_INVALID_QUOTE');
});
test('fees and owner threshold cannot be bypassed', () => {
  const fees = signIntent({ ...fixtureIntent, feeReserveMinor: '3001' }, demoKey);
  assert.equal(check(fees).code, 'REJECT_BUDGET_EXCEEDED');
  assert.equal(check(signIntent({ ...fixtureIntent, humanAboveMinor: '11999' }, demoKey)).code, 'NEEDS_HUMAN_APPROVAL');
  assert.equal(check(signIntent({ ...fixtureIntent, humanAboveMinor: '12000' }, demoKey)).code, 'APPROVE');
});
test('decimal costs round up without floating arithmetic; 0/2/3-place currencies', () => {
  for (const [value, code, expected] of [['0.1', 'USD', '10'], ['150.00000001', 'USD', '15001'], ['1.001', 'USD', '101'], ['1.000', 'USD', '100'], ['0.01', 'JPY', '1'], ['1.2341', 'KWD', '1235'], ['999999999999.99', 'USD', '99999999999999']] as const) assert.equal(decimalToMinor(value, code), expected);
  assert.equal(minorToDecimal('1', 'USD'), '0.01'); assert.equal(minorToDecimal('1234', 'KWD'), '1.234'); assert.equal(minorToDecimal('120', 'JPY'), '120');
  for (const invalid of ['-1', 'NaN', '1e10', 'Infinity']) assert.throws(() => decimalToMinor(invalid, 'USD'));
});
test('malformed and non-positive amounts fail closed', () => {
  for (const amountMinor of ['-1', '0', '1.5', '01', '9999999999999999']) assert.equal(check(envelope, { ...fixturePurchase, amountMinor }).code, 'REJECT_INVALID_INPUT');
  assert.equal(check(envelope, fixturePurchase, quote, NaN).code, 'REJECT_INVALID_INPUT');
  assert.equal(check(envelope, fixturePurchase, quote, DEMO_NOW, '-1').code, 'REJECT_INVALID_INPUT');
});
test('invalid timezone offsets cannot bypass intent or quote expiry', () => {
  for (const time of ['2026-10-27T13:00:00+99:99', '2026-10-27T13:00:00+24:00']) {
    assert.equal(check({ ...envelope, intent: { ...fixtureIntent, expiresAt: time } }).code, 'REJECT_INVALID_INPUT');
    assert.equal(check(envelope, fixturePurchase, { ...quote, expiresAt: time }).code, 'REJECT_INVALID_QUOTE');
    assert.equal(check(envelope, fixturePurchase, { ...quote, validFrom: time }).code, 'REJECT_INVALID_QUOTE');
  }
});
test('signing and verification require Ed25519 keys', () => {
  const otherKey = generateKeyPairSync('ed448');
  assert.throws(() => signIntent(fixtureIntent, otherKey.privateKey), /Ed25519/);
  assert.equal(verifyIntent(envelope, otherKey.publicKey), false);
});
