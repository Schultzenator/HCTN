import { readFileSync } from 'node:fs';
import { Audit } from './audit.js';
import { configuredAirwallex } from './airwallex.js';
import { signedSchema, purchaseSchema } from './domain.js';
import { IntentPay } from './service.js';
const [envelopePath, purchasePath] = process.argv.slice(2);
if (!envelopePath || !purchasePath || !process.env.INTENTPAY_PUBLIC_KEY_PATH) throw new Error('Usage: INTENTPAY_PUBLIC_KEY_PATH=... npm run purchase -- ENVELOPE.json PURCHASE.json');
const bank = await configuredAirwallex();
try {
  const service = new IntentPay(bank.client, new Audit(process.env.AUDIT_PATH ?? 'data/audit.jsonl'), readFileSync(process.env.INTENTPAY_PUBLIC_KEY_PATH, 'utf8'), Date.now, { slackWebhook: process.env.SLACK_WEBHOOK_URL });
  const result = await service.propose(signedSchema.parse(JSON.parse(readFileSync(envelopePath, 'utf8'))), purchaseSchema.parse(JSON.parse(readFileSync(purchasePath, 'utf8'))));
  console.log(JSON.stringify({ mode: bank.client.config.mock ? 'mock' : 'sandbox', ...result }, null, 2));
} finally { await bank.close(); }
