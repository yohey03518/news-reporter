import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { messagingApi } from '@line/bot-sdk';
import { config } from './config.js';
import { logInfo, logError } from './logger.js';
import { uploadImage } from './uploader.js';

const { MessagingApiClient } = messagingApi;

/**
 * Splits a local image file into two equal vertical halves (top and bottom)
 * using Playwright to render and screenshot the two segments.
 */
async function splitImage(filePath: string): Promise<[string, string]> {
  logInfo(`Splitting image ${filePath} into two halves...`);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found for splitting: ${absolutePath}`);
    }
    const base64Data = fs.readFileSync(absolutePath).toString('base64');
    
    let mimeType = 'image/png';
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      mimeType = 'image/jpeg';
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          html, body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background-color: transparent;
          }
          img {
            display: block;
            margin: 0;
            padding: 0;
          }
        </style>
      </head>
      <body>
        <img id="img" src="data:${mimeType};base64,${base64Data}" />
      </body>
      </html>
    `;

    await page.setContent(htmlContent);
    await page.waitForSelector('#img');

    // Wait for the image to load completely
    await page.evaluate(() => {
      const img = document.getElementById('img') as HTMLImageElement;
      return new Promise<void>((resolve) => {
        if (img.complete) {
          resolve();
        } else {
          img.onload = () => resolve();
        }
      });
    });

    const dimensions = await page.evaluate(() => {
      const img = document.getElementById('img') as HTMLImageElement;
      return {
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
    });

    logInfo(`Original image dimensions: ${dimensions.width}x${dimensions.height}`);

    // Set viewport to the full image size so it renders properly
    await page.setViewportSize({
      width: dimensions.width,
      height: dimensions.height,
    });

    const halfHeight = Math.floor(dimensions.height / 2);
    const ext = path.extname(filePath);
    const base = filePath.substring(0, filePath.length - ext.length);
    const part1Path = `${base}-part1${ext}`;
    const part2Path = `${base}-part2${ext}`;

    logInfo(`Saving top half of the image to ${part1Path}`);
    await page.screenshot({
      path: part1Path,
      clip: {
        x: 0,
        y: 0,
        width: dimensions.width,
        height: halfHeight,
      },
    });

    logInfo(`Saving bottom half of the image to ${part2Path}`);
    await page.screenshot({
      path: part2Path,
      clip: {
        x: 0,
        y: halfHeight,
        width: dimensions.width,
        height: dimensions.height - halfHeight,
      },
    });

    return [part1Path, part2Path];
  } catch (error) {
    logError('Error splitting image:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export async function sendSummaryToLine(summary: string, screenshotPath?: string | null): Promise<void> {
  const imageUrls: string[] = [];
  const NINE_MB = 9 * 1024 * 1024; // 9MB limit for safety buffer

  if (screenshotPath && fs.existsSync(screenshotPath)) {
    try {
      const stats = fs.statSync(screenshotPath);
      const sizeInMB = stats.size / (1024 * 1024);

      if (stats.size > NINE_MB) {
        logInfo(`Screenshot size (${sizeInMB.toFixed(2)} MB) exceeds 9MB limit. Splitting into two halves...`);
        const [part1Path, part2Path] = await splitImage(screenshotPath);
        
        logInfo(`Uploading split part 1: ${part1Path}`);
        const url1 = await uploadImage(part1Path);
        if (url1) imageUrls.push(url1);

        logInfo(`Uploading split part 2: ${part2Path}`);
        const url2 = await uploadImage(part2Path);
        if (url2) imageUrls.push(url2);

        // Clean up temporary split files
        try {
          fs.unlinkSync(part1Path);
          fs.unlinkSync(part2Path);
        } catch (cleanupError) {
          logError('Failed to delete split temp files:', cleanupError);
        }
      } else {
        logInfo(`Screenshot size (${sizeInMB.toFixed(2)} MB) is within limits. Uploading...`);
        const url = await uploadImage(screenshotPath);
        if (url) imageUrls.push(url);
      }

      // Clean up the original screenshot file to save space
      try {
        fs.unlinkSync(screenshotPath);
        logInfo(`Deleted original screenshot file: ${screenshotPath}`);
      } catch (cleanupError) {
        logError(`Failed to delete original screenshot ${screenshotPath}:`, cleanupError);
      }
    } catch (error) {
      logError('Failed to process/upload screenshot:', error);
    }
  }

  // Construct final message content: summary + image URLs
  let finalContent = summary || '';
  if (imageUrls.length > 0) {
    if (finalContent) {
      finalContent += '\n' + imageUrls.join('\n');
    } else {
      finalContent = imageUrls.join('\n');
    }
  }

  if (!finalContent) {
    logInfo('No summary or image URLs to send.');
    return;
  }

  const messages: any[] = [{ type: 'text', text: finalContent }];

  const client = new MessagingApiClient({
    channelAccessToken: config.line.channelAccessToken,
  });

  logInfo(`Sending messages to ${config.line.userIds.length} users...`);

  for (const userId of config.line.userIds) {
    try {
      await client.pushMessage({
        to: userId,
        messages,
      });
      logInfo(`Successfully sent to user: ${userId}`);
    } catch (error) {
      logError(`Failed to send to user ${userId}:`, error);
    }
  }
}
