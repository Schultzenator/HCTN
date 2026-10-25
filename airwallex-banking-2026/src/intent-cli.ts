import { generateKeyPairSync } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { intentSchema, signIntent } from './domain.js';
const [command, input, output] = process.argv.slice(2);
if (command === 'keygen') {
  mkdirSync('data', { recursive: true });
  const pair = generateKeyPairSync('ed25519');
  writeFileSync('data/owner-private.pem', pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
  writeFileSync('data/owner-public.pem', pair.publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o600, flag: 'wx' });
  console.log('Created data/owner-{private,public}.pem');
} else if (command === 'sign' && input && output) {
  const key = readFileSync(process.env.INTENTPAY_PRIVATE_KEY_PATH ?? 'data/owner-private.pem', 'utf8');
  writeFileSync(output, JSON.stringify(signIntent(intentSchema.parse(JSON.parse(readFileSync(input, 'utf8'))), key), null, 2), { flag: 'wx', mode: 0o600 });
  console.log(`Signed ${output}`);
} else throw new Error('Usage: npm run intent -- keygen | sign INPUT.json OUTPUT.json');
