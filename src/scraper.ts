import { chromium, Browser, Page } from 'playwright';
import { config } from './config.js';
import { logInfo, logError } from './logger.js';

export async function scrapeArticle(): Promise<string> {
  const browser: Browser = await chromium.launch({ headless: false }); // Set to true for production
  const context = await browser.newContext();
  const page: Page = await context.newPage();

  try {
    logInfo('Navigating to PressPlay...');
    await page.goto('https://www.pressplay.cc/');

    // Handle potential popup
    try {
      await page.locator('.popup-main > .pp-news-feed > .pp-news-feed-close-btn > .icon').click({ timeout: 5000 });
    } catch (e) {
      // Popup might not appear
    }

    logInfo('Logging in...');
    await page.getByRole('button', { name: '登入/註冊' }).click();
    await page.getByRole('textbox', { name: '電子信箱' }).fill(config.pressplay.loginName);
    await page.getByRole('textbox', { name: '密碼' }).fill(config.pressplay.password);
    await page.getByRole('button', { name: '登入', exact: true }).click();

    // Wait for login to complete
    await page.waitForURL(/.*pressplay.cc\/.*/);

    logInfo('Navigating to "My Learning"...');
    await page.getByRole('link', { name: '我的學習' }).nth(2).click();

    logInfo('Navigating to the latest article...');

    // Debugging the target link
    const targetLink = page.locator('.article-card').getByRole('link').nth(0);
    const linkDetails = await targetLink.evaluate((el: HTMLAnchorElement) => ({
      href: el.href,
      outerHTML: el.outerHTML,
      textContent: el.textContent
    }));
    logInfo('Clicking on element with details:', linkDetails);

    await targetLink.click();

    // Wait for the article page to load
    await page.waitForTimeout(3000);

    logInfo('Extracting content...');
    // Use the specific locator provided by the user
    const articleLocator = page.locator('.article-main-content');
    await articleLocator.waitFor({ state: 'visible' });
    const articleContent = await articleLocator.innerText();

    logInfo('Logging out...');
    await page.locator('.pp-avatar.pp-avatar-sm').click();
    await page.getByRole('link', { name: '登出' }).click();

    return articleContent;
  } catch (error) {
    logError('Error during scraping:', error);
    throw error;
  } finally {
    await browser.close();
  }
}
