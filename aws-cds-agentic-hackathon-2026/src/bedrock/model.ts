import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

export interface ChatTurn { role: 'user' | 'assistant'; text: string }
export interface ToolSpec { name: string; description: string; parameters: Record<string, string> }
export interface ToolCall { name: string; args: Record<string, string> }

/**
 * LLM interface. In live mode Amazon Bedrock is used via Converse API with tools.
 * In mock mode a scripted deterministic model drives tests and the offline demo.
 */
export interface Model {
  readonly live: boolean;
  reply(system: string, history: ChatTurn[], tools: ToolSpec[]): Promise<{ text: string; toolCalls: ToolCall[] }>;
}

export class BedrockModel implements Model {
  readonly live = true;
  private client: BedrockRuntimeClient;

  constructor(private modelId = process.env.OMNILOOP_BEDROCK_MODEL ?? 'anthropic.claude-3-5-haiku-20241022-v1:0',
              region = process.env.AWS_REGION ?? 'us-east-1') {
    this.client = new BedrockRuntimeClient({ region });
  }

  async reply(system: string, history: ChatTurn[], tools: ToolSpec[]) {
    const res = await this.client.send(new ConverseCommand({
      modelId: this.modelId,
      system: [{ text: system }],
      messages: history.map(t => ({ role: t.role, content: [{ text: t.text }] })),
      toolConfig: { tools: tools.map(tool => ({ toolSpec: {
        name: tool.name, description: tool.description,
        inputSchema: { json: { type: 'object', properties: Object.fromEntries(
          Object.entries(tool.parameters).map(([name, description]) => [name, { type: 'string', description }])
        ), required: Object.keys(tool.parameters) } }
      } })) }
    }));
    const content = res.output?.message?.content ?? [];
    const text = content.map(c => ('text' in c ? c.text : '')).join('');
    const toolCalls: ToolCall[] = content.flatMap(c => {
      if (!c.toolUse) return [];
      const input = c.toolUse.input;
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid Bedrock tool input');
      return [{ name: c.toolUse.name!, args: Object.fromEntries(
        Object.entries(input).map(([key, value]) => [key, String(value)])
      ) }];
    });
    return { text, toolCalls };
  }
}

/** Deterministic scripted model for tests/offline demo: keyword -> tool call mapping. */
export class ScriptedModel implements Model {
  readonly live = false;
  constructor(private script: (input: string, history: ChatTurn[]) => { text: string; toolCalls: ToolCall[] }) {}
  async reply(_system: string, history: ChatTurn[]) {
    const lastUser = [...history].reverse().find(t => t.role === 'user');
    return this.script((lastUser?.text ?? '').replace(/^\[(sms|rcs|whatsapp|email)\] /, ''), history);
  }
}
