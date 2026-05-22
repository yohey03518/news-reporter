import fs from 'fs';
import path from 'path';

const logDir = 'logs';
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
