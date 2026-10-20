# OmniLoop work state

Status: BLOCKED — local commit requires writable repository metadata

Implementation and verification: COMPLETE.

## Scope and source

All project files and changes are inside `aws-cds-agentic-hackathon-2026/`.
The workspace clone lacked this project; the starter was copied from the untracked
project directory in the local source repository `/home/schultze/Factory/HCTN/`.
The source repository and sibling projects were not modified.

## Changes

- `src/channels/eum.ts`: SMS uses OriginationIdentity; RCS uses
  DestinationPhoneNumber, OriginationIdentity and nested RcsMessageContent.
  Checked against installed SDK declarations in
  `node_modules/@aws-sdk/client-pinpoint-sms-voice-v2/dist-types/models/models_0.d.ts`.
- WhatsApp: real REST POST `/v1/whatsapp/send`, SigV4 with SHA256 from
  `@smithy/hash-node`, plain request object including required HTTPS protocol,
  base64 JSON message payload, no direct `@smithy/protocol-http` dependency.
- `src/channels/ses.ts`: retained real SESv2 SendEmailCommand delivery.
- `src/bedrock/model.ts`: Converse uses modelId and output.message.content;
  added native tool schemas and parsing of toolUse blocks.
- `src/server/webhook.ts`: live mode now selects BedrockModel.
- Fixed scripted model input normalization so demo tools actually execute.
- `src/demo/scenario.ts`: full outbound transcript and email receipt with actual
  generated order ID, product and total.
- `package.json`: Node 22 test runner uses quoted wildcard:
  `tsc && node --test "dist/test/*.test.js"`.
  Added direct hash dependency; removed unused Pinpoint dependency.
- README and architecture now describe current APIs, env variables, normalized
  webhook inputs, in-memory demo scope and live provisioning requirements.
- Added local .gitignore for dependencies, build outputs, .env and logs.

## Verification evidence

Environment: Node v22.22.1, npm 9.2.0.

- `npm install --cache /tmp/omniloop-npm-cache`: success; standard registry;
  0 reported vulnerabilities. No registry configuration changes.
- `npx tsc --noEmit`: exit 0, no TypeScript errors.
- `npm test`: exit 0; src/test/omniloop.test.ts compiled to
  dist/test/omniloop.test.js; 4 tests, 4 passed, 0 failed.
  Order test additionally verifies 2x PS-5X and 298 PLN outbound confirmation.
- `npm run demo`: exit 0; SMS catalog search -> RCS cart (2x PS-5X) ->
  RCS order ORD-UTB4MJ (298 PLN) -> email receipt to demo@example.com with
  matching order ID and total. Order/message IDs vary between runs.
- Additional offline Node assertions intercepted SDK client send methods and
  fetch: verified SendTextMessageCommand, SendRcsMessageCommand,
  SendEmailCommand inputs, actual SHA256 SigV4 Authorization and session-token
  headers, WhatsApp endpoint/base64 payload, Converse tool schema and parsing.
  All assertions passed. No AWS traffic or paid live delivery was performed.

## Delivery

Local commit could not be created because the workspace mounts `.git` read-only.
Attempt: `git add -- .` from the project directory.
Result: exit 128, `fatal: Unable to create
'/home/schultze/Factory/workspaces/aws-cds-omniloop-20261021/repo/.git/index.lock':
Read-only file system`.
No files were staged and no commit or push was performed.
The permission profile explicitly grants read access only to repository metadata;
this session cannot change that permission.

Once `.git` is writable, from the repository root run:

```bash
git add -- aws-cds-agentic-hackathon-2026/
git diff --cached --check
git commit -m "Complete OmniLoop AWS CDS adapters and offline commerce demo"
```

Do not stage the unrelated root session log. No push is needed.

Offline acceptance criteria are complete. Live delivery still requires AWS
credentials, provisioned messaging identities and Bedrock model access described
in README; AWS delivery was not claimed or tested. No AgentCore deployment is included.
