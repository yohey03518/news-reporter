import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  pressplay: {
    loginName: process.env.PRESSPLAY_LOGIN_NAME || '',
    password: process.env.PRESSPLAY_PASSWORD || '',
  },
  line: {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    userIds: (process.env.LINE_USER_IDS || '').split(',').map(id => id.trim()).filter(id => id),
  },
};

export function validateConfig() {
  const missing = [];
  if (!config.pressplay.loginName) missing.push('PRESSPLAY_LOGIN_NAME');
  if (!config.pressplay.password) missing.push('PRESSPLAY_PASSWORD');
  if (!config.line.channelAccessToken) missing.push('LINE_CHANNEL_ACCESS_TOKEN');
  if (config.line.userIds.length === 0) missing.push('LINE_USER_IDS');

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}
