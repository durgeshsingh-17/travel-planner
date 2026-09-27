import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const SMS_SENDER = Symbol('SMS_SENDER');

export interface SmsSender {
  /** `to` is E.164, e.g. +919876543210. */
  send(to: string, body: string): Promise<void>;
}

/**
 * Development sender: writes the message to the server log. Refuses to run in
 * production so codes are never silently "sent" nowhere.
 */
@Injectable()
export class LogSmsSender implements SmsSender {
  private readonly logger = new Logger('SMS');

  async send(to: string, body: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('Text messages are not configured. Set SMS_PROVIDER.');
    }

    this.logger.log(`to ${to.slice(0, 5)}•••${to.slice(-2)}: ${body}`);
  }
}

/** Twilio Programmable Messaging over its REST API (no SDK needed). */
@Injectable()
export class TwilioSmsSender implements SmsSender {
  constructor(private readonly config: ConfigService) {}

  async send(to: string, body: string): Promise<void> {
    const sid = this.config.get<string>('sms.twilioAccountSid');
    const token = this.config.get<string>('sms.twilioAuthToken');
    const from = this.config.get<string>('sms.twilioFrom');

    if (!sid || !token || !from) {
      throw new ServiceUnavailableException('Twilio is not configured');
    }

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ To: to, From: from, Body: body })
    });

    if (!response.ok) {
      throw new ServiceUnavailableException('We could not send the text message. Try again shortly.');
    }
  }
}
