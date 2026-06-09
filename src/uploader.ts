import fs from 'fs';
import { config } from './config.js';
import { logInfo, logError } from './logger.js';

/**
 * Uploads a local image file to Imgbb.
 * Returns the public direct image URL, or null if upload fails.
 */
export async function uploadImage(filePath: string): Promise<string | null> {
  try {
    if (!config.imgbb.apiKey) {
      logInfo('Imgbb API key is missing. Skipping upload.');
      return null;
    }

    if (!fs.existsSync(filePath)) {
      logError(`Image file to upload does not exist: ${filePath}`);
      return null;
    }

    logInfo(`Uploading screenshot to Imgbb: ${filePath}...`);
    const base64Image = fs.readFileSync(filePath, { encoding: 'base64' });

    const body = new URLSearchParams();
    body.append('image', base64Image);
    // Auto-expire the image after 10 minutes (600 seconds) to ensure cleanup
    body.append('expiration', '600');

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${config.imgbb.apiKey}`, {
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }

    const result = await response.json() as any;
    logInfo('Imgbb API response:', result);

    if (result && result.success && result.data && result.data.url) {
      const imageUrl = result.data.url;
      logInfo(`Screenshot successfully uploaded to Imgbb: ${imageUrl}`);
      return imageUrl;
    } else {
      throw new Error(`Invalid response structure: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    logError('Failed to upload screenshot to Imgbb:', error);
    return null;
  }
}
