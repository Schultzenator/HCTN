import { startMock } from './mock.js';
const mock = await startMock(Date.now, Number(process.env.PORT ?? 4010));
console.log(`Airwallex contract mock: ${mock.url}/api/v1 (mock-client / mock-key)`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, async () => { await mock.close(); process.exit(0); });
