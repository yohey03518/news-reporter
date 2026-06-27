import fs from 'fs/promises';
import path from 'path';
import { validateConfig } from './config.js';
import { scrapeArticle } from './scraper.js';
import { summarizeContent } from './summarizer.js';
import { sendSummaryToLine } from './lineClient.js';
import { getLocalDateString, logInfo, logError, logDir } from './logger.js';

async function main() {
  try {
    logInfo('--- Starting News Reporter ---');

    // 1. Validate environment variables
    validateConfig();

    const dateStr = getLocalDateString();
    const promptFilePath = path.join(logDir, `${dateStr}.txt`);
    const screenshotUrlsPath = path.join(logDir, `${dateStr}-screenshot-urls.txt`);

    let summary: string;
    let cachedPromptExists = false;

    try {
      await fs.access(promptFilePath);
      cachedPromptExists = true;
    } catch {
      cachedPromptExists = false;
    }

    if (cachedPromptExists) {
      logInfo(`Found cached prompt file for today: ${promptFilePath}. Skipping scraping.`);
      
      // Read the prompt
      const prompt = await fs.readFile(promptFilePath, 'utf8');

      // Summarize directly using the cached prompt
      summary = await summarizeContent(prompt, true);
      logInfo('Summary generated from cache.');

      // Load cached image URLs
      let cachedUrls: string[] = [];
      try {
        const urlsContent = await fs.readFile(screenshotUrlsPath, 'utf8');
        cachedUrls = urlsContent.split('\n').map(url => url.trim()).filter(Boolean);
        logInfo(`Loaded cached screenshot URLs:`, cachedUrls);
      } catch {
        logInfo('No cached screenshot URLs found.');
      }

      // Send to LINE
      await sendSummaryToLine(summary, null, cachedUrls);

    } else {
      // Normal first run
      // 2. Scrape the article and capture screenshot
      const { content, screenshotPath } = await scrapeArticle();
      if (!content) {
        throw new Error('No article content found.');
      }
      logInfo(`Article content extracted (${content.length} characters).`);

      // 3. Summarize the content
      summary = await summarizeContent(content, false);
      logInfo('Summary generated.');

      // 4. Send to LINE (handles screenshot checking, splitting, uploading, and sending)
      await sendSummaryToLine(summary, screenshotPath, []);
    }

    logInfo('--- News Reporter Finished Successfully ---');
  } catch (error) {
    logError('--- News Reporter Failed ---', error);
    process.exit(1);
  }
}

main();

