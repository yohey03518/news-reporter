import { messagingApi } from '@line/bot-sdk';
import { config } from './config.js';

const { MessagingApiClient } = messagingApi;

export async function sendSummaryToLine(summary: string): Promise<void> {
  if (!summary) {
    console.warn('No summary to send.');
    return;
  }

  const client = new MessagingApiClient({
    channelAccessToken: config.line.channelAccessToken,
  });

  console.log(`Sending summary to ${config.line.userIds.length} users...`);

  for (const userId of config.line.userIds) {
    try {
      await client.pushMessage({
        to: userId,
        messages: [{ type: 'text', text: summary }],
      });
      console.log(`Successfully sent to user: ${userId}`);
    } catch (error) {
      console.error(`Failed to send to user ${userId}:`, error);
    }
  }
}
