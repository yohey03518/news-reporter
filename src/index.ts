import { validateConfig } from './config.js';
import { scrapeArticle } from './scraper.js';
import { summarizeContent } from './summarizer.js';
import { sendSummaryToLine } from './lineClient.js';
import { logInfo, logError } from './logger.js';

async function main() {
  try {
    logInfo('--- Starting News Reporter ---');

    // 1. Validate environment variables
    validateConfig();

    // 2. Scrape the article
    const content = await scrapeArticle();
    if (!content) {
      throw new Error('No article content found.');
    }
    logInfo(`Article content extracted (${content.length} characters).`);

    // 3. Summarize the content
    const summary = await summarizeContent(content);
    logInfo('Summary generated.');

    // 4. Send to LINE
    await sendSummaryToLine(summary);

    logInfo('--- News Reporter Finished Successfully ---');
  } catch (error) {
    logError('--- News Reporter Failed ---', error);
    process.exit(1);
  }
}

main();

