import { createPrivateKey } from 'node:crypto';
import type { Intent, Purchase } from './domain.js';
// Public fixture seed for repeatable demos ONLY. Never used by the server or owner's keygen.
export const demoKey = createPrivateKey({ key: Buffer.from('302e020100300506032b657004220420' + '11'.repeat(32), 'hex'), format: 'der', type: 'pkcs8' });
export const fixtureIntent: Intent = { version: 1, id: '10000000-0000-4000-8000-000000000001', budgetMinor: '15000', baseCurrency: 'USD', targetCurrency: 'EUR', merchants: ['monitor-store'], expiresAt: '2026-10-27T13:00:00Z', feeReserveMinor: '0' };
export const fixturePurchase: Purchase = { id: '20000000-0000-4000-8000-000000000001', merchant: 'monitor-store', amountMinor: '10800', currency: 'EUR', rail: 'card' };
