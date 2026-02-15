/**
 * geminikit - Browser automation for Google Gemini image generation
 *
 * Uses Playwright with persistent browser profiles. First run opens a
 * visible browser for Google login; subsequent runs reuse the session.
 *
 * ```typescript
 * import { generateImage } from 'geminikit';
 *
 * // First run: headless=false to login
 * const result = await generateImage(
 *   'a neon-lit cyberpunk cityscape at night',
 *   './output.png',
 *   { headless: false }
 * );
 *
 * // After login, headless works
 * const result2 = await generateImage('prompt', './out.png');
 * ```
 */

export { GeminiClient } from './client';
export { GeminiBrowser } from './browser';
export type { GeminiConfig, GenerateImageOptions, ImageResult } from './types';
export {
  GeminiError,
  AuthenticationError,
  GenerationError,
  BrowserError,
  isGeminiError,
  getErrorGuidance,
} from './errors';

import { GeminiClient } from './client';
import type { GenerateImageOptions, ImageResult } from './types';

/**
 * Generate an image with Gemini — manages browser lifecycle automatically.
 * First run should use headless=false to log in to Google manually.
 */
export async function generateImage(
  prompt: string,
  outputPath: string,
  options: GenerateImageOptions = {}
): Promise<ImageResult> {
  const client = new GeminiClient();
  try {
    await client.connect({ headless: options.headless });
    return await client.generateImage(prompt, outputPath, options);
  } finally {
    await client.disconnect();
  }
}
