import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { ChannelAdapter, OutboundMessage } from './types.js';

/**
 * Live adapter for Amazon Simple Email Service (SES) - an AWS CDS service.
 * Sends transactional conversation turns as email via SESv2 SendEmail.
 */
export class SesAdapter implements ChannelAdapter {
  readonly channel = 'email' as const;
  readonly live = true;
  private client: SESv2Client;

  constructor(region = process.env.AWS_REGION ?? 'us-east-1',
              private from = process.env.OMNILOOP_SES_FROM ?? '') {
    this.client = new SESv2Client({ region });
  }

  async send(msg: OutboundMessage) {
    if (!this.from) throw new Error('OMNILOOP_SES_FROM not configured (verified SES identity)');
    const res = await this.client.send(new SendEmailCommand({
      FromEmailAddress: this.from,
      Destination: { ToAddresses: [msg.to] },
      Content: {
        Simple: {
          Subject: { Data: 'OmniLoop', Charset: 'UTF-8' },
          Body: { Text: { Data: msg.text, Charset: 'UTF-8' } }
        }
      }
    }));
    return { messageId: res.MessageId ?? 'ses', provider: 'ses' };
  }
}
