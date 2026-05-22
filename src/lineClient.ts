import { messagingApi } from '@line/bot-sdk';
import { config } from './config.js';
import { logInfo, logError } from './logger.js';

const { MessagingApiClient } = messagingApi;

export async function sendSummaryToLine(summary: string): Promise<void> {
  if (!summary) {
    logInfo('No summary to send.');
    return;
  }

  const client = new MessagingApiClient({
    channelAccessToken: config.line.channelAccessToken,
  });

  logInfo(`Sending summary to ${config.line.userIds.length} users...`);

  for (const userId of config.line.userIds) {
    try {
      await client.pushMessage({
        to: userId,
        messages: [{ type: 'text', text: summary }],
      });
      logInfo(`Successfully sent to user: ${userId}`);
    } catch (error) {
      logError(`Failed to send to user ${userId}:`, error);
    }
  }
}
