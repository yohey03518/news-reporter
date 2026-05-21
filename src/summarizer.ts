import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execPromise = promisify(exec);

export async function summarizeContent(content: string): Promise<string> {
  console.log('Calling Gemini CLI for summary...');

  // TODO: Fill in your specific Gemini prompt here
  const prompt = `Please summarize the following article content:

  ${content}`;

  const tempFilePath = path.join(os.tmpdir(), `gemini-prompt-${Date.now()}.txt`);

  try {
    // Write prompt to a temporary file
    await fs.writeFile(tempFilePath, prompt, 'utf8');

    // Call gemini CLI reading from the file
    // Adjust this command to match how your gemini CLI accepts file input
    // If it supports stdin: cat tempFilePath | gemini
    // If it supports a file argument: gemini --file tempFilePath
    // Here we'll try a common pattern: gemini < tempFilePath
    const { stdout, stderr } = await execPromise(`gemini < "${tempFilePath}"`);

    if (stderr) {
      console.warn('Gemini CLI stderr:', stderr);
    }

    return stdout.trim();
  } catch (error) {
    console.error('Error calling Gemini CLI:', error);
    throw new Error('Failed to generate summary from Gemini CLI.');
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(tempFilePath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

