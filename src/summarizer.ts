import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function summarizeContent(content: string): Promise<string> {
  console.log('Calling Gemini CLI for summary...');

  // TODO: Fill in your specific Gemini prompt here
  const prompt = `Please summarize the following article content:
  
  ${content}`;

  // We use a temporary file or a heredoc to pass large content to the CLI
  // For simplicity, we'll try to pass it as an argument, but be mindful of shell limits.
  // A better way would be to write to a temp file and read from it.
  
  try {
    // Assuming gemini cli takes the prompt as an argument. 
    // Adjust the command if your local gemini cli has a different syntax.
    // e.g., gemini "your prompt"
    const { stdout, stderr } = await execPromise(`gemini "${prompt.replace(/"/g, '\\"')}"`);
    
    if (stderr) {
      console.warn('Gemini CLI stderr:', stderr);
    }
    
    return stdout.trim();
  } catch (error) {
    console.error('Error calling Gemini CLI:', error);
    throw new Error('Failed to generate summary from Gemini CLI.');
  }
}
