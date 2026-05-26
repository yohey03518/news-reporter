import { chromium, Browser, Page } from 'playwright';
import { config } from './config.js';
import { logInfo, logError } from './logger.js';

export async function scrapeArticle(): Promise<string> {
  const browser: Browser = await chromium.launch({ headless: false }); // Set to true for production
  const context = await browser.newContext();
  const page: Page = await context.newPage();

  const STEP_DELAY_MS = 2000;
  const TYPING_DELAY_MS = 100;

  try {
    logInfo('Navigating to PressPlay...');
    await page.goto('https://www.pressplay.cc/');
    await page.waitForTimeout(STEP_DELAY_MS);

    try {
      await page.locator('.popup-main > .pp-news-feed > .pp-news-feed-close-btn > .icon').click({ timeout: 5000 });
    } catch (e) {
      // Popup might not appear
    }
    await page.waitForTimeout(STEP_DELAY_MS);

    logInfo('Logging in...');
    await page.getByRole('button', { name: '登入/註冊' }).click();
    await page.waitForTimeout(STEP_DELAY_MS);

    await page.getByRole('textbox', { name: '電子信箱' }).pressSequentially(config.pressplay.loginName, { delay: TYPING_DELAY_MS });
    await page.waitForTimeout(STEP_DELAY_MS);

    await page.getByRole('textbox', { name: '密碼' }).pressSequentially(config.pressplay.password, { delay: TYPING_DELAY_MS });
    await page.waitForTimeout(STEP_DELAY_MS);

    await page.getByRole('button', { name: '登入', exact: true }).click();

    await page.waitForURL(/.*pressplay.cc\/.*/);
    await page.waitForTimeout(STEP_DELAY_MS);

    logInfo('Navigating to "My Learning"...');
    await page.getByRole('link', { name: '我的學習' }).nth(2).click();
    await page.waitForTimeout(STEP_DELAY_MS);

    logInfo('Navigating to the latest article...');

    const targetLink = page.locator('.article-card').getByRole('link').nth(0);
    const linkDetails = await targetLink.evaluate((el: HTMLAnchorElement) => ({
      href: el.href,
      outerHTML: el.outerHTML,
      textContent: el.textContent
    }));
    logInfo('Clicking on element with details:', linkDetails);

    await targetLink.click();
    await page.waitForTimeout(STEP_DELAY_MS);

    logInfo('Extracting content...');
    const articleLocator = page.locator('.article-main-content');
    await articleLocator.waitFor({ state: 'visible' });
    const articleContent = await articleLocator.innerText();
    await page.waitForTimeout(STEP_DELAY_MS);

    logInfo('Logging out...');
    await page.locator('.pp-avatar.pp-avatar-sm').click();
    await page.waitForTimeout(STEP_DELAY_MS);

    await page.getByRole('link', { name: '登出' }).click();
    await page.waitForTimeout(STEP_DELAY_MS);

    return articleContent;
  } catch (error) {
    logError('Error during scraping:', error);
    throw error;
  } finally {
    await browser.close();
  }
}
