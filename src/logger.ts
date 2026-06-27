import fs from 'fs';
import path from 'path';
import { Page } from 'playwright';

export const logDir = process.env.LOG_DIR || 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function getTimestamp() {
  return new Date().toISOString();
}

export function logInfo(message: string, ...args: any[]) {
  const formattedArgs = args.length ? ' ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ') : '';
  const logEntry = `[${getTimestamp()}] INFO: ${message}${formattedArgs}\n`;
  
  process.stdout.write(logEntry);
  logStream.write(logEntry);
}

export function logError(message: string, error?: any) {
  let logEntry = `[${getTimestamp()}] ERROR: ${message}\n`;
  if (error) {
    logEntry += `${error.stack || error}\n`;
  }
  
  process.stderr.write(logEntry);
  logStream.write(logEntry);
}

export async function logScreenshot(page: Page, namePrefix: string): Promise<string | null> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${namePrefix}-${timestamp}.png`;
    const filePath = path.join(logDir, filename);

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }

    await page.screenshot({ path: filePath, fullPage: true });
    logInfo(`Screenshot saved to ${filePath}`);
    return filePath;
  } catch (error) {
    logError('Failed to capture screenshot:', error);
    return null;
  }
}

export function getLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

