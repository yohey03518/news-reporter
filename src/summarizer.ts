import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { getLocalDateString, logInfo, logError } from './logger.js';

const execPromise = promisify(exec);

export async function summarizeContent(contentOrPrompt: string, isPromptAlready: boolean = false): Promise<string> {
  logInfo('Calling AGY CLI for summary...');

  const dateStr = getLocalDateString();
  const promptFilePath = path.join('logs', `${dateStr}.txt`);

  if (!isPromptAlready) {
    // contentOrPrompt is raw content, format it as prompt
    const prompt = `請根據以下文章內容，按照指定格式進行總結，過程中可以先列出所有族群及個股，避免最後總結時有所遺漏。所有內容都不要自己腦補也不要自行推論，所有文字都從文章中做摘要：

{日期}水位建議：{持股水位建議}（{簡短理由}）

  整體盤勢說明：{50字內，涵蓋美股／費半／台股大盤／櫃買走勢與均線位置}

  個股族群
  - {族群名稱}（{族群定位／操作建議，例如：強勢主流、持股抱牢}）：
    - {股票代號} {股票名稱} — {操作觀察重點／表現}
    - {股票代號} {股票名稱} — {操作觀察重點／表現}

  - {總經資訊}
  - {午報變化}

  填寫提示：
  - 日期：使用文章標題上的日期，格式為YYYY/MM/DD
  - 持股水位建議：例 三成／五成／滿水位，括號內補上理由，直接使用文章內容針對持股水位的所有文字，無須做摘要
  - 整體盤勢說明：限 50 字內，涵蓋美股族群（費半／那斯達克）、台股大盤、櫃買的均線位置與多空狀態
  - 族群分類：文章有提到的族群都要列上來，依文章中提到的定位分類，若有提到轉弱族群亦需列上，此區僅列出台股
  - 個股條目：一律使用「代號 名稱 — 觀察重點」格式，每檔換行
  - 總經資訊：50 字內簡述總體經濟相關內容，不要自己腦補也不要自行推論，所有文字都從文章中做摘要
  - 午報變化：若作者（老王）提及後續有請假或是出國等情事會導致未來暫停發文，則在這邊簡短描述，若沒有相關內容則留空

文章內容如下：
${contentOrPrompt}`;

    try {
      await fs.mkdir('logs', { recursive: true });
      await fs.writeFile(promptFilePath, prompt, 'utf8');
    } catch (error) {
      logError('Error writing prompt cache file:', error);
      throw new Error('Failed to cache prompt.');
    }
  }

  try {
    // Call agy CLI reading from the cache file using shell expansion and detaching stdin to prevent hangs
    const { stdout, stderr } = await execPromise(`agy -p "$(cat ${promptFilePath})"`);

    if (stderr) {
      logInfo('AGY CLI stderr:', stderr);
    }

    return stdout.trim();
  } catch (error) {
    logError('Error calling AGY CLI:', error);
    throw new Error('Failed to generate summary from AGY CLI.');
  }
}

