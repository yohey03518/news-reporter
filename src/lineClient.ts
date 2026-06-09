import { messagingApi } from '@line/bot-sdk';
import { config } from './config.js';
import { logInfo, logError } from './logger.js';

const { MessagingApiClient } = messagingApi;

export async function sendSummaryToLine(summary: string, imageUrl?: string | null): Promise<void> {
  const messages: any[] = [];
  if (summary) {
    messages.push({ type: 'text', text: summary });
  }
  if (imageUrl) {
    messages.push({
      type: 'image',
      originalContentUrl: imageUrl,
      previewImageUrl: 'https://picsum.photos/200',
    });
  }

  if (messages.length === 0) {
    logInfo('No summary or image to send.');
    return;
  }

  const client = new MessagingApiClient({
    channelAccessToken: config.line.channelAccessToken,
  });

  logInfo(`Sending messages to ${config.line.userIds.length} users...`);

  for (const userId of config.line.userIds) {
    try {
      await client.pushMessage({
        to: userId,
        messages,
      });
      logInfo(`Successfully sent to user: ${userId}`);
    } catch (error) {
      logError(`Failed to send to user ${userId}:`, error);
    }
  }
}
