import { readFileSync } from 'node:fs';
import { Audit } from './audit.js';
import { recordApproval, replay } from './service.js';
const [command = 'replay', requestId, reviewer, ...reason] = process.argv.slice(2);
const audit = new Audit(process.env.AUDIT_PATH ?? 'data/audit.jsonl');
if (command === 'query') console.log(JSON.stringify(audit.read(requestId), null, 2));
else if (command === 'replay') {
  const key = process.env.INTENTPAY_PUBLIC_KEY_PATH ? readFileSync(process.env.INTENTPAY_PUBLIC_KEY_PATH, 'utf8') : undefined;
  const result = replay(audit, key); console.log(JSON.stringify({ ...result, policyVerified: Boolean(key) }, null, 2));
  if (!result.matches) process.exitCode = 1;
} else if (command === 'approve' || command === 'deny') {
  if (!requestId || !reviewer || !reason.length) throw new Error('Usage: approve|deny REQUEST_ID REVIEWER REASON');
  // Local operator CLI only. No approval tool is exposed to an agent or remote HTTP client.
  await recordApproval(audit, requestId, reviewer, command === 'approve', reason.join(' '));
  console.log(`Human ${command} recorded for ${requestId}; replacement signed envelope required to execute.`);
} else throw new Error('Usage: query [REQUEST_ID] | replay | approve|deny REQUEST_ID REVIEWER REASON');
