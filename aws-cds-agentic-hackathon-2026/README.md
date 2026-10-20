# OmniLoop — agentic omnichannel commerce on AWS CDS

**One conversation, every channel.** OmniLoop is an agentic commerce assistant for the
[AWS Communication Developer Services (CDS) Agentic AI Partner Hackathon](https://aws-cds-partner.devpost.com/).

A customer thread starts on SMS, continues on RCS with zero context loss, gets the order
placed on RCS (or WhatsApp), and the receipt lands in email — all driven by one agent that treats
**AWS CDS as its communications backbone**:

- **AWS End User Messaging (EUM)** — two-way SMS and RCS (text messaging API)
- **AWS End User Messaging Social** — WhatsApp messages
- **Amazon SES** — email receipts and confirmations
- **Amazon Bedrock** (Converse API with tool use) — the agent brain

## The idea

Today's messaging is fragmented: OTPs, one-way notifications, scripted chatbots that lose
the thread the moment a customer switches apps. OmniLoop keeps **one conversation state per
customer, not per channel**. Every turn — inbound or outbound — is written to shared
conversation memory, so the agent picks up exactly where the last message stopped, on any
channel. The agent has tools (catalog search, cart, orders, cross-channel send) and decides
itself which channel to use next based on customer intent.

Demo story (runs offline in mock mode, same code path as live):
1. Customer asks on **SMS** about powerbanks → agent searches catalog, answers.
2. Customer switches to **RCS** → agent continues with full history, adds to cart.
3. Order placed via **RCS/WhatsApp** → agent confirms.
4. Customer asks for the receipt by email → agent sends it through **SES**.

## Quick start (offline mock mode — no AWS account needed)

```bash
npm install
npm run demo     # cross-channel scenario end-to-end
npm test         # four integration tests (Node 22 test runner)
npm run typecheck # TypeScript validation
npm start        # webhook server (mock mode) on :3002
```

## Live mode (real AWS CDS at runtime)

```bash
export AWS_REGION=us-east-1
# SES: verify an identity, then set the sender
export OMNILOOP_SES_FROM=no-reply@yourdomain.com
# EUM: register origination numbers (phone number origination in AWS End User Messaging)
export OMNILOOP_EUM_FROM_SMS=+1xxxxxxxxxx      # SMS-capable
export OMNILOOP_EUM_FROM_RCS=your-rcs-agent-id # RcsAgentId/ARN or PoolId/ARN
# EUM Social: linked WhatsApp Business Account phone number ID
export OMNILOOP_WHATSAPP_PHONE_NUMBER_ID=phone-number-id-xxxxxxxx
export OMNILOOP_WHATSAPP_META_API_VERSION=v23.0
export OMNILOOP_BEDROCK_MODEL=anthropic.claude-3-5-haiku-20241022-v1:0

OMNILOOP_MODE=live npm start
```

Inbound webhooks (two-way messaging):
- `POST /webhook/eum` — `{ "channel": "sms"|"rcs"|"whatsapp", "from": "+48...", "text": "...", "messageId": "..." }`
- `POST /webhook/ses` — normalized email JSON with `mail.commonHeaders.from` and `content` or `text`

The webhook endpoints accept normalized JSON from a trusted event bridge; raw SNS
envelopes and MIME email must be decoded upstream. This demo server uses the seeded
customer `c1` and in-memory state; restart clears conversations and orders.
It is intended for local evaluation, not public deployment.

Live mode selects `BedrockModel`, sends tool schemas through Converse and executes
the returned tool calls. AWS credentials use the standard SDK provider chain.
Configure permissions for `bedrock:InvokeModel`, `sms-voice:SendTextMessage`,
`sms-voice:SendRcsMessage`, `social-messaging:SendWhatsAppMessage`, and `ses:SendEmail`,
and provision the corresponding messaging identities and model access.
No AgentCore deployment is included. Live delivery requires configured AWS resources
and is separate from the offline demo.

WhatsApp uses a SigV4-signed REST request to `/v1/whatsapp/send`; its `message`
field is base64-encoded JSON as required by the
[AWS SendWhatsAppMessage API](https://docs.aws.amazon.com/social-messaging/latest/APIReference/API_SendWhatsAppMessage.html).
Choose a Meta API version supported by the configured AWS region.
SMS, RCS and email use real AWS SDK v3 commands.

The offline demo always uses mock channels and a scripted model, even if live
environment variables are present. It prints SMS search, RCS cart/order, and an
email receipt containing the generated order ID and total (298 PLN).

## Architecture

See [docs/architecture.md](docs/architecture.md) for the diagram.

## License

MIT (see repository root LICENSE).
