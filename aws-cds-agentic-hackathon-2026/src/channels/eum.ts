import { PinpointSMSVoiceV2Client, SendTextMessageCommand, SendRcsMessageCommand } from '@aws-sdk/client-pinpoint-sms-voice-v2';
import type { ChannelAdapter, OutboundMessage } from './types.js';

/**
 * Live adapters for AWS End User Messaging (EUM) - an AWS CDS service.
 * - SMS:  EUM text messaging (Pinpoint SMS Voice v2 API - SendTextMessage).
 * - RCS:  EUM RCS messaging (SendRcsMessage, rich content via RCS agent).
 * - WhatsApp: EUM Social (AWS End User Messaging Social API POST /v1/whatsapp/send,
 *   SigV4-signed with @smithy/signature-v4 and @smithy/hash-node).
 */
export class EumAdapter implements ChannelAdapter {
  readonly live = true;
  private sms: PinpointSMSVoiceV2Client | null = null;

  constructor(readonly channel: 'sms' | 'rcs' | 'whatsapp',
              private region = process.env.AWS_REGION ?? 'us-east-1') {}

  async send(msg: OutboundMessage) {
    if (this.channel === 'whatsapp') return this.sendWhatsapp(msg);
    if (!this.sms) this.sms = new PinpointSMSVoiceV2Client({ region: this.region });
    if (this.channel === 'rcs') {
      const origination = process.env.OMNILOOP_EUM_FROM_RCS;
      if (!origination) throw new Error('OMNILOOP_EUM_FROM_RCS not configured (RCS agent origination)');
      const res = await this.sms.send(new SendRcsMessageCommand({
        DestinationPhoneNumber: msg.to,
        OriginationIdentity: origination,
        RcsMessageContent: { Content: { TextMessage: { Body: msg.text } } }
      }));
      return { messageId: res.MessageId ?? 'eum-rcs', provider: 'eum-rcs' };
    }
    const origination = process.env.OMNILOOP_EUM_FROM_SMS;
    if (!origination) throw new Error('OMNILOOP_EUM_FROM_SMS not configured');
    const res = await this.sms.send(new SendTextMessageCommand({
      DestinationPhoneNumber: msg.to,
      OriginationIdentity: origination,
      MessageBody: msg.text
    }));
    return { messageId: res.MessageId ?? 'eum-sms', provider: 'eum-sms' };
  }

  private async sendWhatsapp(msg: OutboundMessage) {
    const phoneNumberId = process.env.OMNILOOP_WHATSAPP_PHONE_NUMBER_ID;
    const metaApiVersion = process.env.OMNILOOP_WHATSAPP_META_API_VERSION ?? 'v23.0';
    if (!phoneNumberId) throw new Error('OMNILOOP_WHATSAPP_PHONE_NUMBER_ID not configured');
    const { SignatureV4 } = await import('@smithy/signature-v4');
    const { defaultProvider } = await import('@aws-sdk/credential-provider-node');
    const { Hash } = await import('@smithy/hash-node');
    const body = JSON.stringify({
      message: Buffer.from(JSON.stringify({
        messaging_product: 'whatsapp',
        to: msg.to,
        type: 'text',
        text: { body: msg.text }
      })).toString('base64'),
      metaApiVersion,
      originationPhoneNumberId: phoneNumberId
    });
    const signer = new SignatureV4({
      credentials: defaultProvider(),
      region: this.region,
      service: 'social-messaging',
      sha256: Hash.bind(null, 'sha256')
    });
    const request = {
      method: 'POST',
      protocol: 'https:',
      hostname: 'social-messaging.' + this.region + '.amazonaws.com',
      path: '/v1/whatsapp/send',
      headers: { 'content-type': 'application/json', host: 'social-messaging.' + this.region + '.amazonaws.com' },
      body
    };
    const signed = await signer.sign(request);
    const res = await fetch('https://' + signed.hostname + signed.path, {
      method: 'POST',
      headers: signed.headers as Record<string, string>,
      body: signed.body
    });
    if (!res.ok) throw new Error('eum-whatsapp ' + res.status + ': ' + (await res.text()).slice(0, 300));
    const json = (await res.json()) as { messageId?: string };
    return { messageId: json.messageId ?? 'eum-whatsapp', provider: 'eum-whatsapp' };
  }
}
