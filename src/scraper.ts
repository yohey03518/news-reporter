import { chromium, devices, Browser, Page } from 'playwright';
import { config } from './config.js';
import { logInfo, logError, logScreenshot } from './logger.js';

export interface ScrapeResult {
  content: string;
  screenshotPath: string | null;
}

export async function scrapeArticle(): Promise<ScrapeResult> {
  const browser: Browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false'
  });
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

    await page.goto('https://www.pressplay.cc/member/learning/projects/CF6DA5CB5BE8C843FE37526843D3E126/articles');
    await page.waitForURL(/.*pressplay.cc\/.*/);
    await page.waitForTimeout(STEP_DELAY_MS);

    const targetLink = page.locator('.article-card').getByRole('link').nth(0);
    const linkDetails = await targetLink.evaluate((el: HTMLAnchorElement) => ({
      href: el.href,
      outerHTML: el.outerHTML,
      textContent: el.textContent
    }));
    logInfo('Clicking on element with details:', linkDetails);

    await targetLink.click();
    await page.waitForTimeout(STEP_DELAY_MS);

    const articleUrl = page.url();
    logInfo(`Article URL captured: ${articleUrl}`);

    let screenshotPath: string | null = null;
    logInfo('Capturing mobile screenshot...');
    const storageState = await context.storageState();
    const mobileContext = await browser.newContext({
      ...devices['iPhone 12'],
      storageState: storageState,
    });
    const mobilePage = await mobileContext.newPage();

    logInfo(`Navigating mobile page to ${articleUrl}...`);
    await mobilePage.goto(articleUrl);

    const mobileArticleLocator = mobilePage.locator('.article-main-content');
    await mobileArticleLocator.waitFor({ state: 'visible' });
    await mobilePage.waitForTimeout(STEP_DELAY_MS);
    const articleContent = await mobileArticleLocator.innerText();

    screenshotPath = await logScreenshot(mobilePage, 'mobile-article');
    await mobileContext.close();

    return {
      content: articleContent,
      screenshotPath,
    };
  } catch (error) {
    logError('Error during scraping:', error);
    try {
      await logScreenshot(page, 'error-scrape');
    } catch (screenshotError) {
      logError('Failed to take error screenshot:', screenshotError);
    }
    throw error;
  } finally {
    try {
      logInfo('Logging out...');
      await page.locator('.pp-avatar.pp-avatar-sm').click();
      await page.waitForTimeout(STEP_DELAY_MS);

      await page.getByRole('link', { name: '登出' }).click();
      await page.waitForTimeout(STEP_DELAY_MS);
    } catch (logoutError) {
      logError('Failed to log out:', logoutError);
    }
    await browser.close();
  }
}
