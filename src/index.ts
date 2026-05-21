import { validateConfig } from './config.js';
import { scrapeArticle } from './scraper.js';
import { summarizeContent } from './summarizer.js';
import { sendSummaryToLine } from './lineClient.js';

async function main() {
  try {
    console.log('--- Starting News Reporter ---');
    
    // 1. Validate environment variables
    validateConfig();

    // 2. Scrape the article
    const content = await scrapeArticle();
    if (!content) {
      throw new Error('No article content found.');
    }
    console.log(`Article content extracted (${content.length} characters).`);

    // 3. Summarize the content
    const summary = await summarizeContent(content);
    console.log('Summary generated.');

    // 4. Send to LINE
    await sendSummaryToLine(summary);

    console.log('--- News Reporter Finished Successfully ---');
  } catch (error) {
    console.error('--- News Reporter Failed ---');
    console.error(error);
    process.exit(1);
  }
}

main();
