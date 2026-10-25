import { createHash, type KeyObject } from 'node:crypto';
import { Audit } from './audit.js';
import { Airwallex } from './airwallex.js';
import { canonical, checkPolicy, signedSchema, purchaseSchema, verifyIntent, type SignedIntent, type Purchase, type Decision } from './domain.js';
export interface ServiceOptions { slackWebhook?: string; log?: (message: string) => void }
export class IntentPay {
  constructor(readonly bank: Airwallex, readonly audit: Audit, readonly ownerKey: KeyObject | string, readonly now: () => number = Date.now, readonly options: ServiceOptions = {}) {}
  private spent(intentId: string): string {
    return this.audit.read().filter(e => e.type === 'reservation' && e.data.intentId === intentId).reduce((n, e) => n + BigInt(e.data.costMinor), 0n).toString();
  }
  async check(envelope: SignedIntent, purchase: Purchase): Promise<Decision> {
    // Reject untrusted/expired/currency/merchant input before even fetching an FX quote.
    const early = checkPolicy(envelope, purchase, {}, this.ownerKey, this.now(), this.spent(envelope.intent.id));
    if (early.code !== 'REJECT_INVALID_QUOTE') return early;
    const quote = await this.bank.quote(envelope, purchase);
    return checkPolicy(envelope, purchase, quote, this.ownerKey, this.now(), this.spent(envelope.intent.id));
  }
  async propose(envelope: SignedIntent, purchase: Purchase): Promise<any> {
    const e = signedSchema.parse(envelope), p = purchaseSchema.parse(purchase);
    return this.audit.exclusive(async () => {
      const fingerprint = createHash('sha256').update(canonical({ envelope: e, purchase: p })).digest('hex');
      const previous = this.audit.read(p.id);
      if (previous.length) {
        if (previous.find(v => v.type === 'intent')?.data.fingerprint !== fingerprint) throw new Error('Request ID reused with different input');
        const result = previous.find(v => v.type === 'result');
        if (result) return result.data;
        throw new Error('Incomplete operation: budget remains reserved; reconcile with Airwallex before retry');
      }
      const existing = this.audit.read().find(v => v.type === 'intent' && v.data.envelope.intent.id === e.intent.id && verifyIntent(v.data.envelope, this.ownerKey));
      if (verifyIntent(e, this.ownerKey) && existing && canonical(existing.data.envelope) !== canonical(e)) throw new Error('Intent ID is immutable; use a new ID for replacement envelopes');
      this.audit.append('intent', p.id, { envelope: e, purchase: p, fingerprint });
      let evaluatedAt = this.now();
      let decision = checkPolicy(e, p, {}, this.ownerKey, evaluatedAt, this.spent(e.intent.id));
      let quote;
      if (decision.code === 'REJECT_INVALID_QUOTE') {
        try { quote = await this.bank.quote(e, p); this.audit.append('quote', p.id, quote); }
        catch (err) { this.audit.append('error', p.id, { stage: 'quote', message: String(err) }); throw err; }
        evaluatedAt = this.now();
        decision = checkPolicy(e, p, quote, this.ownerKey, evaluatedAt, this.spent(e.intent.id));
      }
      this.audit.append('decision', p.id, decision, evaluatedAt);
      if (decision.code !== 'APPROVE') {
        // Never seek overrides for forged signatures. Valid owner intent is required even for escalation.
        if (verifyIntent(e, this.ownerKey)) await this.notify(p.id, decision);
        const result = { requestId: p.id, decision, action: null };
        this.audit.append('result', p.id, result); return result;
      }
      if (!quote) throw new Error('Missing quote');
      // Recheck immediately before the write. Reservation is durable before an external side effect.
      evaluatedAt = this.now();
        decision = checkPolicy(e, p, quote, this.ownerKey, evaluatedAt, this.spent(e.intent.id));
      if (decision.code !== 'APPROVE') {
        this.audit.append('decision', p.id, decision, evaluatedAt); await this.notify(p.id, decision);
        const result = { requestId: p.id, decision, action: null }; this.audit.append('result', p.id, result); return result;
      }
      this.audit.append('reservation', p.id, { intentId: e.intent.id, costMinor: decision.costMinor, rail: p.rail });
      try {
        const action = p.rail === 'card' ? await this.bank.card(e, p, quote) : await this.bank.payout(e, p, quote);
        this.audit.append(p.rail === 'card' ? 'card_action' : 'payment_action', p.id, action);
        const result = { requestId: p.id, decision, action };
        this.audit.append('result', p.id, result); return result;
      } catch (err) { this.audit.append('error', p.id, { stage: 'execution', message: String(err), reservationRetained: true }); throw err; }
    });
  }
  private async notify(requestId: string, decision: Decision): Promise<void> {
    this.audit.append('approval_requested', requestId, { decision, status: 'PENDING' });
    const text = `IntentPay ${requestId}: ${decision.code}. Review locally: npm run audit -- approve ${requestId} <reviewer> <reason>. Approval records owner consent; execution requires a newly signed envelope and new request ID.`;
    let delivered = false;
    if (this.options.slackWebhook) {
      try {
        const response = await fetch(this.options.slackWebhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(5000) });
        delivered = response.ok;
      } catch { /* Console remains available when Slack is unreachable. */ }
    }
    this.audit.append('approval_notification', requestId, { channel: delivered ? 'slack' : 'console' });
    if (!delivered) (this.options.log ?? console.log)(text);
  }
  async recordApproval(requestId: string, reviewer: string, approved: boolean, reason: string): Promise<void> {
    return recordApproval(this.audit, requestId, reviewer, approved, reason);
  }
}
export function replay(audit: Audit, ownerKey?: KeyObject | string): { decisions: number; matches: boolean; results: unknown[] } {
  const rows = audit.read(), spent = new Map<string, bigint>();
  let decisions = 0, matches = true;
  for (const row of rows) {
    if (row.type === 'decision' && ownerKey) {
      const context = rows.find(e => e.type === 'intent' && e.requestId === row.requestId)!.data;
      const quote = rows.find(e => e.type === 'quote' && e.requestId === row.requestId)?.data ?? {};
      const actual = checkPolicy(context.envelope, context.purchase, quote, ownerKey, Date.parse(row.timestamp), (spent.get(context.envelope.intent.id) ?? 0n).toString());
      matches &&= canonical(actual) === canonical(row.data); decisions++;
    }
    if (row.type === 'reservation') spent.set(row.data.intentId, (spent.get(row.data.intentId) ?? 0n) + BigInt(row.data.costMinor));
  }
  return { decisions, matches, results: rows.filter(e => ['result', 'human_approval'].includes(e.type)).map(e => ({ requestId: e.requestId, type: e.type, ...e.data })) };
}

export async function recordApproval(audit: Audit, requestId: string, reviewer: string, approved: boolean, reason: string): Promise<void> {
    if (!reviewer.trim() || !reason.trim()) throw new Error('Reviewer and reason required');
    await audit.exclusive(async () => {
      const rows = audit.read(requestId);
      if (!rows.some(e => e.type === 'approval_requested')) throw new Error('No pending approval');
      if (rows.some(e => e.type === 'human_approval')) throw new Error('Approval already resolved');
      audit.append('human_approval', requestId, { reviewer, approved, reason, execution: 'requires newly signed owner envelope and new request ID' });
    });
}
