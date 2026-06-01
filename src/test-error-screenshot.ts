import { chromium } from 'playwright';
import { logScreenshot, logInfo } from './logger.js';

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    logInfo('Navigating to example.com...');
    await page.goto('https://example.com');
    
    logInfo('Attempting to click non-existent element to trigger error...');
    await page.click('#non-existent-id', { timeout: 2000 });
  } catch (error) {
    logInfo('Caught expected error, taking screenshot...');
    await logScreenshot(page, 'test-error');
  } finally {
    await browser.close();
    logInfo('Test complete.');
  }
}

runTest();
