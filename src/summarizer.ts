import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { getLocalDateString, logInfo, logError, logDir } from './logger.js';

const execPromise = promisify(exec);

export async function summarizeContent(contentOrPrompt: string, isPromptAlready: boolean = false): Promise<string> {
  logInfo('Calling AGY CLI for summary...');

  const dateStr = getLocalDateString();
  const promptFilePath = path.join(logDir, `${dateStr}.txt`);

  if (!isPromptAlready) {
    // contentOrPrompt is raw content, format it as prompt
    const prompt = `請根據以下文章內容，按照指定格式進行總結，思考過程中可以先列出所有族群及個股(含ETF)，避免最後總結時有所遺漏。所有內容都不要自己腦補也不要自行推論，所有文字都從文章中做摘要：
文章內容如下：
\`\`\`${contentOrPrompt}\`\`\`

思考過程結束後務必加上以下符號「---」，然後再開始總結

總結格式如下：
\`\`\`
{日期}水位建議：{持股水位建議}（{簡短理由}）

  整體盤勢說明：{50字內，涵蓋美股／費半／台股大盤／櫃買走勢與均線位置}

  個股族群
  - {族群名稱}（{族群定位／操作建議，例如：強勢主流、持股抱牢}）：
    - {股票代號} {股票名稱} — {操作觀察重點／表現}
    - {股票代號} {股票名稱} — {操作觀察重點／表現}

  - {總經資訊}
  // 若有午報變化的相關內容才顯示下面這行，若沒有相關內容則這行直接刪除，連\`- 午報變化\` 的標頭都不要顯示
  - {午報變化}

  填寫提示：
  - 日期：使用文章標題上的日期，格式為YYYY/MM/DD
  - 持股水位建議：例 三成／五成／滿水位，括號內補上理由，直接使用文章內容針對持股水位的所有文字，無須做摘要
  - 整體盤勢說明：限 50 字內，涵蓋美股族群（費半／那斯達克）、台股大盤、櫃買的均線位置與多空狀態
  - 族群分類：文章有提到的族群都要列上來，依文章中提到的定位分類，若有提到轉弱族群亦需列上，此區僅列出台股
  - 個股條目：一律使用「代號 名稱 — 觀察重點」格式，每檔換行
  - 總經資訊：50 字內簡述總體經濟相關內容，不要自己腦補也不要自行推論，所有文字都從文章中做摘要
  - 午報變化：若作者（老王）提及後續有請假或是出國等情事會導致未來暫停發文，則在這邊簡短描述
\`\`\`
`;

    try {
      await fs.mkdir(logDir, { recursive: true });
      await fs.writeFile(promptFilePath, prompt, 'utf8');
    } catch (error) {
      logError('Error writing prompt cache file:', error);
      throw new Error('Failed to cache prompt.');
    }
  }

  // `agy` forks a long-lived background daemon that inherits its stdout. When
  // the output is captured through a pipe (exec's default), that pipe never
  // reaches EOF — the daemon keeps the write-end open after `agy` itself exits —
  // so the call hangs forever. The fix: give `agy` /dev/null for stdin
  // (immediate EOF) and redirect its stdout/stderr to files, so the daemon
  // inherits *file* descriptors instead of Node's pipe. We then read the result
  // back from the files.
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-'));
  const outFile = path.join(tmpDir, 'out.txt');
  const errFile = path.join(tmpDir, 'err.txt');

  let stdoutContent = '';
  let stderrContent = '';
  let commandFailed = false;
  let commandError: any = null;

  try {
    // Read the prompt from the cache file via shell expansion; redirect stdio
    // to files so the lingering daemon can't hold Node's stdout pipe open.
    await execPromise(
      `agy -p "$(cat ${promptFilePath})" < /dev/null > "${outFile}" 2> "${errFile}"`,
    );
  } catch (error) {
    commandFailed = true;
    commandError = error;
  }

  try {
    stdoutContent = await fs.readFile(outFile, 'utf8');
  } catch (e) {
    logError('Failed to read stdout file:', e);
  }
  try {
    stderrContent = await fs.readFile(errFile, 'utf8');
  } catch (e) {
    logError('Failed to read stderr file:', e);
  }

  const isAuthRequired =
    stdoutContent.includes('Authentication required') ||
    stdoutContent.includes('Please visit the URL to log in') ||
    stderrContent.includes('Authentication required') ||
    stderrContent.includes('Please visit the URL to log in');

  if (isAuthRequired) {
    logError('================================================================================');
    logError('AGY CLI authentication required.');
    logError('To resolve this, please follow these steps:');
    logError('1. Get into the container by running:');
    logError('   docker exec -it jarvis-agent-1 agy -p "any prompt"');
    logError('2. Follow the prompt to visit the URL and log in.');
    logError('3. After successful login, terminate or restart the container.');
    logError('================================================================================');

    await delayOneDay();
    throw new Error('Failed to generate summary from AGY CLI: Authentication required.');
  }

  if (commandFailed) {
    logError('Error calling AGY CLI:', commandError);
    if (stderrContent.trim()) {
      logError('AGY CLI stderr output:', stderrContent.trim());
    }
    if (stdoutContent.trim()) {
      logError('AGY CLI stdout output:', stdoutContent.trim());
    }
    throw new Error('Failed to generate summary from AGY CLI.');
  }

  try {
    if (stderrContent.trim()) {
      logInfo('AGY CLI stderr:', stderrContent.trim());
    }

    const parts = stdoutContent.split('---');
    if (parts.length < 2) {
      logError('AGY CLI stdout does not contain "---" separator. Full output:', stdoutContent);
      throw new Error('Failed to parse summary: missing "---" separator.');
    }
    const summary = parts[1].trim();
    logInfo('AGY CLI summary:', summary);
    return summary;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function delayOneDay(): Promise<void> {
  logInfo('Starting a 24-hour delay. The container will remain active so you can log in...');

  let timer: NodeJS.Timeout | undefined;
  const sleepPromise = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, 24 * 60 * 60 * 1000); // 24 hours
  });

  const signalHandler = (signal: string) => {
    logInfo(`Received signal ${signal}. Exiting delay immediately.`);
    if (timer) {
      clearTimeout(timer);
    }
    process.exit(0);
  };

  const sigtermHandler = () => signalHandler('SIGTERM');
  const sigintHandler = () => signalHandler('SIGINT');

  process.on('SIGTERM', sigtermHandler);
  process.on('SIGINT', sigintHandler);

  try {
    await sleepPromise;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    process.off('SIGTERM', sigtermHandler);
    process.off('SIGINT', sigintHandler);
  }
}


